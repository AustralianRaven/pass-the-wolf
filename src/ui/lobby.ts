import { PICKABLE } from '../animals/registry';
import { SEAT_COLOURS, TARGET_CHOICES, type Setup } from '../game/settings';
import { LocalGuest, LocalHost } from '../net/local';
import { joinOnlineRoom, newRoomCode } from '../net/online';
import { NetSession, type GameEvent, type Player, type StartInfo } from '../net/session';
import { COLOUR_NAMES } from './view';

/**
 * "Play with friends" (#2): pick how to connect, gather the pack, and deal.
 *
 * - Online: the host gets a room code and a link; friends join with either. Free public relays
 *   only introduce the players; the game itself goes directly between your devices.
 * - Local network: no internet at all. The host makes an invite code for each friend; the friend
 *   pastes it and sends back a reply code. Then the devices talk directly over your Wi-Fi.
 */

export interface LobbyDefaults {
  readonly name: string;
  readonly colour: string;
  readonly animal: string;
}

export type LobbyStart = (session: NetSession, info: StartInfo, replay: readonly { ev: GameEvent; by: string }[]) => void;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: { class?: string; text?: string; attrs?: Record<string, string> } = {}, children: Node[] = []): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props.class) node.className = props.class;
  if (props.text !== undefined) node.textContent = props.text;
  for (const [k, v] of Object.entries(props.attrs ?? {})) node.setAttribute(k, v);
  node.append(...children);
  return node;
}

const button = (text: string, cls = 'tab tab--quiet') => el('button', { class: cls, text, attrs: { type: 'button' } });

async function copy(text: string, status: (t: string) => void): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    status('Copied.');
  } catch {
    status('Select the code and copy it.');
  }
}

/** Unique colours for the deal: keep each player's pick unless someone earlier already has it. */
function dealColours(players: readonly Player[]): string[] {
  const used = new Set<string>();
  return players.map((p) => {
    const colour = used.has(p.colour) ? (SEAT_COLOURS.find((c) => !used.has(c)) ?? p.colour) : p.colour;
    used.add(colour);
    return colour;
  });
}

export function openLobby(root: HTMLElement, defaults: LobbyDefaults, onStart: LobbyStart, roomFromLink: string | null = null): void {
  let session: NetSession | null = null;
  let target: number = 100;

  const dialog = el('dialog', { class: 'sheet lobby block', attrs: { 'aria-labelledby': 'lobby-title' } });
  const close = button('Close');
  const status = el('p', { class: 'lobby__status', attrs: { role: 'status', 'aria-live': 'polite' } });
  const say = (t: string) => (status.textContent = t);

  // ----- You -----
  const nameInput = el('input', { class: 'lobby__input', attrs: { id: 'lobby-name', maxlength: '16', autocomplete: 'nickname', value: defaults.name } });
  const colourSelect = el('select', { class: 'lobby__input', attrs: { id: 'lobby-colour' } });
  for (const c of SEAT_COLOURS) {
    const o = el('option', { text: COLOUR_NAMES[c] ?? c, attrs: { value: c } });
    o.selected = c === defaults.colour;
    colourSelect.append(o);
  }
  const animalSelect = el('select', { class: 'lobby__input', attrs: { id: 'lobby-animal' } });
  for (const a of PICKABLE) {
    const o = el('option', { text: a.scoring.name, attrs: { value: a.scoring.id } });
    o.selected = a.scoring.id === defaults.animal;
    animalSelect.append(o);
  }
  const me = () => ({ name: nameInput.value.trim() || 'Wolf', colour: colourSelect.value, animal: animalSelect.value });
  const you = el('fieldset', { class: 'lobby__you' }, [
    el('legend', { class: 'sheet__h', text: 'You' }),
    el('label', { class: 'lobby__field' }, [el('span', { text: 'Name' }), nameInput]),
    el('label', { class: 'lobby__field' }, [el('span', { text: 'Collar' }), colourSelect]),
    el('label', { class: 'lobby__field' }, [el('span', { text: 'Animal' }), animalSelect]),
  ]);

  // ----- How to connect -----
  const ways = el('div', { class: 'lobby__ways', attrs: { role: 'radiogroup', 'aria-label': 'How to connect' } });
  const panel = el('div', { class: 'lobby__panel' });
  const way = (value: 'online' | 'local', label: string, detail: string) => {
    const input = el('input', { attrs: { type: 'radio', name: 'lobby-way', value } });
    input.addEventListener('change', () => show(value));
    ways.append(el('label', { class: 'mode' }, [input, el('span', { class: 'mode__label', text: label }), el('span', { class: 'mode__detail', text: detail })]));
    return input;
  };
  const onlineRadio = way('online', 'Online', 'Over the internet, with a room code');
  way('local', 'Local network', 'Same Wi-Fi, no internet: swap a code');

  // ----- The pack -----
  const roster = el('ul', { class: 'lobby__roster' });
  const targetSelect = el('select', { class: 'lobby__input', attrs: { id: 'lobby-target' } });
  for (const t of TARGET_CHOICES) {
    const o = el('option', { text: `First to ${t}`, attrs: { value: String(t) } });
    o.selected = t === 100;
    targetSelect.append(o);
  }
  targetSelect.addEventListener('change', () => (target = Number(targetSelect.value)));
  const startButton = button('Deal the wolves', 'tab tab--roll');
  startButton.disabled = true;
  const hostFoot = el('div', { class: 'lobby__foot' }, [el('label', { class: 'lobby__field' }, [el('span', { text: 'Race' }), targetSelect]), startButton]);
  hostFoot.hidden = true;
  const pack = el('section', { class: 'lobby__pack' }, [el('h3', { class: 'sheet__h', text: 'The pack' }), roster, hostFoot]);
  pack.hidden = true;

  const renderRoster = (players: readonly Player[]) => {
    pack.hidden = false;
    roster.replaceChildren(
      ...players.map((p) =>
        el('li', { class: `lobby__player${p.connected ? '' : ' is-away'}` }, [
          el('span', { class: 'lobby__dot', attrs: { style: `background:${p.colour}`, 'aria-hidden': 'true' } }),
          el('span', { class: 'lobby__pname', text: p.name }),
          el('span', { class: 'lobby__panimal', text: PICKABLE.find((a) => a.scoring.id === p.animal)?.scoring.name ?? '' }),
          el('span', { class: 'lobby__pstate', text: p.connected ? (p.id === session?.selfId ? 'You' : 'Connected') : 'Away' }),
        ]),
      ),
    );
    startButton.disabled = !session?.isHost || players.filter((p) => p.connected).length < 2;
  };

  const begin = (s: NetSession) => {
    session = s;
    you.disabled = true;
    ways.querySelectorAll('input').forEach((i) => (i.disabled = true));
    hostFoot.hidden = !s.isHost;
    s.onRoster = renderRoster;
    s.onClosed = (reason) => say(reason);
    s.onStart = (info, replay) => {
      dialog.close();
      onStart(s, info, replay);
    };
    renderRoster(s.roster);
  };

  startButton.addEventListener('click', () => {
    session?.start((players) => {
      const here = players.filter((p) => p.connected);
      const colours = dealColours(here);
      const setup: Setup = {
        mode: 'table',
        targetScore: target,
        seats: here.map((p, i) => ({ name: p.name, kind: 'human', colour: colours[i]!, dice: [p.animal, p.animal] })),
      };
      return { setup, owners: here.map((p) => p.id) };
    });
  });

  // ----- Online -----
  const onlinePanel = () => {
    const codeInput = el('input', { class: 'lobby__input lobby__code', attrs: { id: 'lobby-room', placeholder: 'WOLF-ABCDE', autocomplete: 'off', value: roomFromLink ?? '' } });
    const host = button('Host a room', 'tab tab--roll');
    const join = button('Join');
    const shared = el('div', { class: 'lobby__share' });
    host.addEventListener('click', async () => {
      host.disabled = join.disabled = true;
      const code = newRoomCode();
      say('Opening the room…');
      try {
        const s = new NetSession(await joinOnlineRoom(code), 'host', me());
        begin(s);
        const link = `${location.origin}${location.pathname}?room=${code}`;
        const copyLink = button('Copy invite link');
        copyLink.addEventListener('click', () => void copy(link, say));
        shared.replaceChildren(el('p', { class: 'lobby__room', text: code }), copyLink);
        say('Room open. Send your friends the code or the link.');
      } catch {
        say('Could not reach the relays. Check your internet, or try Local network.');
        host.disabled = join.disabled = false;
      }
    });
    join.addEventListener('click', async () => {
      const code = codeInput.value.trim().toUpperCase();
      if (!code) return say('Type the room code first.');
      host.disabled = join.disabled = true;
      say('Looking for the room…');
      try {
        const s = new NetSession(await joinOnlineRoom(code), 'guest', me());
        begin(s);
        s.hello();
        say(`Joined ${code}. Waiting for the host to deal…`);
        // If nobody answers, a direct connection probably can't be made on this network.
        setTimeout(() => {
          if (!s.roster.length) say('No host found yet. Check the code; on strict networks a direct connection can fail. Local network may work instead.');
        }, 15000);
      } catch {
        say('Could not reach the relays. Check your internet, or try Local network.');
        host.disabled = join.disabled = false;
      }
    });
    return el('div', { class: 'lobby__online' }, [
      el('div', { class: 'lobby__row' }, [host]),
      el('p', { class: 'lobby__or', text: 'or join a friend' }),
      el('div', { class: 'lobby__row' }, [el('label', { class: 'lobby__field' }, [el('span', { text: 'Room code' }), codeInput]), join]),
      shared,
    ]);
  };

  // ----- Local network -----
  const localPanel = () => {
    const host = button('Host on this device', 'tab tab--roll');
    const join = button('Join a host');
    const area = el('div', { class: 'lobby__local' });
    const codeBox = (label: string, value: string) => {
      const box = el('textarea', { class: 'lobby__codebox', attrs: { readonly: '', rows: '3', 'aria-label': label } });
      box.value = value;
      const c = button('Copy');
      c.addEventListener('click', () => void copy(value, say));
      return el('div', { class: 'lobby__codewrap' }, [el('span', { class: 'lobby__codelabel', text: label }), box, c]);
    };
    const pasteBox = (label: string) => el('textarea', { class: 'lobby__codebox', attrs: { rows: '3', 'aria-label': label, placeholder: label } });

    host.addEventListener('click', () => {
      host.disabled = join.disabled = true;
      const transport = new LocalHost();
      begin(new NetSession(transport, 'host', me()));
      const invite = button('Invite a player');
      area.replaceChildren(invite);
      invite.addEventListener('click', async () => {
        invite.disabled = true;
        say('Making an invite code…');
        const { code, accept } = await transport.invite();
        const reply = pasteBox("Paste their reply code");
        const connect = button('Connect', 'tab tab--roll');
        const step = el('div', { class: 'lobby__step' }, [codeInput(code), reply, connect]);
        area.replaceChildren(invite, step);
        say('Send this invite code to one friend. Paste the reply code they send back.');
        connect.addEventListener('click', async () => {
          try {
            connect.disabled = true;
            say('Connecting…');
            await accept(reply.value);
            step.remove();
            invite.disabled = false;
            say('Connected. Invite another player, or deal the wolves.');
          } catch {
            connect.disabled = false;
            say("That reply code didn't work. Check it was copied whole.");
          }
        });
      });
      function codeInput(code: string) {
        return codeBox('Invite code (send to one friend)', code);
      }
    });

    join.addEventListener('click', () => {
      host.disabled = join.disabled = true;
      const inviteBox = pasteBox("Paste the host's invite code");
      const reply = button('Make my reply code', 'tab tab--roll');
      area.replaceChildren(inviteBox, reply);
      say("Paste the invite code your host sent you.");
      reply.addEventListener('click', async () => {
        const transport = new LocalGuest();
        try {
          reply.disabled = true;
          const { code, connected } = await transport.answer(inviteBox.value);
          const s = new NetSession(transport, 'guest', me());
          begin(s);
          area.replaceChildren(codeBox('Your reply code (send back to the host)', code));
          say('Send this reply code back to the host. You will connect when they paste it.');
          await connected;
          s.hello();
          say('Connected. Waiting for the host to deal…');
        } catch {
          reply.disabled = false;
          say("That invite code didn't work. Check it was copied whole.");
        }
      });
    });
    return el('div', {}, [
      el('div', { class: 'lobby__row' }, [host, join]),
      el('p', { class: 'lobby__note', text: 'Every device must be on the same network. Each friend needs their own invite code.' }),
      area,
    ]);
  };

  const show = (value: 'online' | 'local') => panel.replaceChildren(value === 'online' ? onlinePanel() : localPanel());

  dialog.append(
    el('header', { class: 'sheet__head' }, [el('h2', { text: 'Play with friends', attrs: { id: 'lobby-title' } }), close]),
    el('div', { class: 'lobby__body' }, [you, el('fieldset', { class: 'lobby__how' }, [el('legend', { class: 'sheet__h', text: 'How to connect' }), ways, panel]), pack, status]),
  );
  close.addEventListener('click', () => {
    session?.leave();
    dialog.close();
  });
  dialog.addEventListener('close', () => dialog.remove());
  root.append(dialog);
  onlineRadio.checked = true;
  show('online');
  dialog.showModal();
}
