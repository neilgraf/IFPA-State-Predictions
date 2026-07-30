/**
 * Setup GUI for the bracket simulator.
 *
 * The roster in `state.players` is the single source of truth; its array index
 * is the player's seed - 1, so list order is bracket order.
 */

const state = {
    config: null,
    playerCount: 24,
    players: [],      // [{ name, rating }] length === playerCount
    chart: null,
    payload: null,    // last /api/simulate response
    forced: [],       // [{ round, match, winner }] the "what if" scenario
    tab: 'bracket',
    chartStale: true, // Chart.js can't size a canvas inside a hidden panel
};

const el = (id) => document.getElementById(id);

/* ------------------------------------------------------------------ */
/* Parsing pasted rosters                                              */
/* ------------------------------------------------------------------ */

// 2-4 digits so a "Jr 3" style suffix isn't mistaken for a rating.
const RATING_PATTERN = /^\d{2,4}(?:\.\d+)?$/;

/**
 * Turns pasted text into [{name, rating}]. Tolerates the shapes people
 * actually copy out of standings pages:
 *   Neil Graf
 *   Neil Graf, 1779
 *   Neil Graf<TAB>1779
 *   3. Neil Graf 1779
 *   3  Neil Graf  1779
 */
function parseRosterText(text) {
    const parsed = [];

    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line) continue;

        // Strip a leading seed marker ("3.", "3)", "#3", or "3 " before a name).
        const withoutSeed = line
            .replace(/^#?\d{1,2}\s*[.)\-:]\s*/, '')
            .replace(/^#?\d{1,2}\s+(?=\D)/, '');

        let name = withoutSeed;
        let rating = null;

        // Prefer an explicit delimiter: comma, tab, or a run of 2+ spaces.
        const fields = withoutSeed
            .split(/\s*[,\t]\s*|\s{2,}/)
            .map((f) => f.trim())
            .filter(Boolean);

        if (fields.length >= 2 && RATING_PATTERN.test(fields[fields.length - 1])) {
            rating = Number(fields.pop());
            name = fields.join(' ');
        } else {
            // Fall back to a trailing number after a single space.
            const match = withoutSeed.match(/^(.+?)\s+(\d{2,4}(?:\.\d+)?)$/);
            if (match) {
                name = match[1];
                rating = Number(match[2]);
            }
        }

        name = name.replace(/\s+/g, ' ').trim();
        if (name) parsed.push({ name, rating });
    }

    return parsed;
}

/* ------------------------------------------------------------------ */
/* Roster state                                                        */
/* ------------------------------------------------------------------ */

function blankPlayer() {
    return { name: '', rating: null };
}

/** Grows or trims the roster to `count` seeds, keeping what's already there. */
function setPlayerCount(count) {
    state.playerCount = count;
    const players = state.players.slice(0, count);
    while (players.length < count) players.push(blankPlayer());
    state.players = players;

    for (const button of el('size-buttons').children) {
        button.setAttribute('aria-pressed', String(Number(button.dataset.size) === count));
    }
    renderBracketSummary();
    renderRoster();
}

function bracketSizeFor(count) {
    let size = 2;
    while (size < count) size *= 2;
    return size;
}

function renderBracketSummary() {
    const count = state.playerCount;
    const size = bracketSizeFor(count);
    const byes = size - count;
    const filled = state.players.filter((p) => p.name.trim()).length;

    let text = `${count}-player single-elimination bracket`;
    text += byes
        ? ` — ${size} slots, so the top ${byes} ${byes === 1 ? 'seed gets a bye' : 'seeds get byes'} into round 2.`
        : ' — every seed plays round 1.';
    text += ` ${filled} of ${count} names entered.`;
    el('bracket-summary').textContent = text;
}

function renderRoster() {
    const grid = el('roster-grid');
    grid.innerHTML = '';

    state.players.forEach((player, index) => {
        const row = document.createElement('div');
        row.className = 'roster-row';

        const seed = document.createElement('span');
        seed.className = 'seed';
        seed.textContent = index + 1;

        const name = document.createElement('input');
        name.type = 'text';
        name.value = player.name;
        name.placeholder = `Seed ${index + 1} name`;
        name.setAttribute('aria-label', `Seed ${index + 1} name`);
        name.addEventListener('input', () => {
            state.players[index].name = name.value;
            name.classList.remove('invalid');
            renderBracketSummary();
        });

        const rating = document.createElement('input');
        rating.type = 'number';
        rating.step = '1';
        rating.value = player.rating === null ? '' : player.rating;
        rating.placeholder = state.config ? state.config.default_rating : '1500';
        rating.setAttribute('aria-label', `Seed ${index + 1} rating`);
        rating.addEventListener('input', () => {
            state.players[index].rating = rating.value === '' ? null : Number(rating.value);
        });

        row.append(seed, name, rating);
        grid.append(row);
    });
}

function setStatus(id, message, kind) {
    const node = el(id);
    node.textContent = message;
    node.className = kind ? `status ${kind}` : 'status';
}

/* ------------------------------------------------------------------ */
/* Roster actions                                                      */
/* ------------------------------------------------------------------ */

/** Grows the field to fit `needed` players, returning the size actually used. */
function growToFit(needed) {
    if (needed <= state.playerCount) return state.playerCount;
    const fit = state.config.supported_sizes.find((size) => size >= needed);
    setPlayerCount(fit || state.config.max_players);
    return state.playerCount;
}

function loadPaste(append) {
    const parsed = parseRosterText(el('paste-box').value);
    if (!parsed.length) {
        setStatus('paste-status', 'Nothing to load — paste one player per line first.', 'error');
        return;
    }

    const start = append ? state.players.findIndex((p) => !p.name.trim()) : 0;
    if (append && start === -1) {
        setStatus('paste-status', 'Every seed is already filled. Use "Load into roster" to replace them.', 'error');
        return;
    }

    const capacity = growToFit(start + parsed.length);
    const used = Math.min(parsed.length, capacity - start);

    if (!append) state.players = Array.from({ length: capacity }, blankPlayer);
    for (let i = 0; i < used; i += 1) {
        state.players[start + i] = { name: parsed[i].name, rating: parsed[i].rating };
    }

    renderBracketSummary();
    renderRoster();

    const dropped = parsed.length - used;
    const withRatings = parsed.slice(0, used).filter((p) => p.rating !== null).length;
    let message = `Loaded ${used} player${used === 1 ? '' : 's'} (${withRatings} with ratings).`;
    if (dropped > 0) {
        message += ` ${dropped} didn't fit in a ${capacity}-player field and ${dropped === 1 ? 'was' : 'were'} skipped.`;
    }
    setStatus('paste-status', message, dropped > 0 ? 'error' : 'ok');
}

function loadSample() {
    const datasets = state.config.datasets;
    const key = datasets.new_wi ? 'new_wi' : Object.keys(datasets)[0];
    const roster = datasets[key];

    setPlayerCount(state.config.supported_sizes.find((s) => s >= roster.length) || roster.length);
    roster.forEach((player, index) => {
        state.players[index] = { name: player.name, rating: player.rating };
    });

    renderBracketSummary();
    renderRoster();
    el('paste-box').value = roster.map((p) => `${p.name}, ${p.rating}`).join('\n');
    setStatus('paste-status', `Loaded the ${roster.length}-player sample roster.`, 'ok');
}

function sortByRating() {
    const defaultRating = state.config.default_rating;
    const named = state.players.filter((p) => p.name.trim());
    const blanks = state.playerCount - named.length;

    named.sort((a, b) => (b.rating ?? defaultRating) - (a.rating ?? defaultRating));
    state.players = named.concat(Array.from({ length: blanks }, blankPlayer));

    renderRoster();
    setStatus('paste-status', 'Re-seeded by rating, highest first.', 'ok');
}

async function copyRoster() {
    const text = state.players
        .filter((p) => p.name.trim())
        .map((p) => (p.rating === null ? p.name : `${p.name}, ${p.rating}`))
        .join('\n');

    if (!text) {
        setStatus('paste-status', 'Roster is empty — nothing to copy.', 'error');
        return;
    }
    try {
        await navigator.clipboard.writeText(text);
        setStatus('paste-status', 'Roster copied to the clipboard.', 'ok');
    } catch {
        el('paste-box').value = text;
        setStatus('paste-status', "Couldn't reach the clipboard, so the roster was put back in the paste box.", 'error');
    }
}

function clearRoster() {
    state.players = Array.from({ length: state.playerCount }, blankPlayer);
    renderBracketSummary();
    renderRoster();
    setStatus('paste-status', 'Roster cleared.', 'ok');
}

async function importFromMatchPlay() {
    const id = el('matchplay-id').value.trim();
    if (!id) {
        setStatus('matchplay-status', 'Enter a MatchPlay tournament ID first.', 'error');
        return;
    }

    const button = el('matchplay-import');
    button.disabled = true;
    setStatus('matchplay-status', 'Fetching from MatchPlay…', null);

    try {
        const response = await fetch(`/api/matchplay/${encodeURIComponent(id)}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Server returned ${response.status}.`);
        if (!data.players.length) throw new Error('That tournament returned no players.');

        const capacity = growToFit(data.players.length);
        state.players = Array.from({ length: capacity }, blankPlayer);
        data.players.slice(0, capacity).forEach((player, index) => {
            state.players[index] = { name: player.name, rating: player.rating };
        });

        renderBracketSummary();
        renderRoster();

        let message = `Imported ${Math.min(data.players.length, capacity)} players.`;
        if (data.unresolved_ratings.length) {
            message += ` No IFPA rating found for ${data.unresolved_ratings.length}` +
                       ` (${data.unresolved_ratings.slice(0, 3).join(', ')}` +
                       `${data.unresolved_ratings.length > 3 ? '…' : ''}) — they'll default to ` +
                       `${state.config.default_rating}, so check them before running.`;
        }
        setStatus('matchplay-status', message, data.unresolved_ratings.length ? 'error' : 'ok');
    } catch (error) {
        setStatus('matchplay-status', error.message || 'Import failed.', 'error');
    } finally {
        button.disabled = false;
    }
}

/* ------------------------------------------------------------------ */
/* Running the simulation                                              */
/* ------------------------------------------------------------------ */

function collectMissingSeeds() {
    const missing = [];
    state.players.forEach((player, index) => {
        if (!player.name.trim()) missing.push(index + 1);
    });
    return missing;
}

function flagMissing(seeds) {
    const rows = el('roster-grid').children;
    for (const seed of seeds) {
        const input = rows[seed - 1] && rows[seed - 1].querySelector('input[type="text"]');
        if (input) input.classList.add('invalid');
    }
    if (seeds.length) rows[seeds[0] - 1].scrollIntoView({ block: 'center', behavior: 'smooth' });
}

/** Posts the current roster + scenario. `statusId` is where errors surface. */
async function requestSimulation(statusId) {
    const response = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            players: state.players.map((p) => ({ name: p.name.trim(), rating: p.rating })),
            simulations: Number(el('simulations').value),
            best_of: Number(el('best-of').value),
            seed: el('rng-seed').value === '' ? null : Number(el('rng-seed').value),
            forced: state.forced,
        }),
    });

    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `Server returned ${response.status}.`);
    return payload;
}

async function runSimulation() {
    const missing = collectMissingSeeds();
    if (missing.length) {
        const shown = missing.slice(0, 8).join(', ');
        setStatus(
            'run-status',
            `Missing ${missing.length} name${missing.length === 1 ? '' : 's'} — fill in seed${missing.length === 1 ? '' : 's'} ${shown}${missing.length > 8 ? '…' : ''}.`,
            'error'
        );
        flagMissing(missing);
        return;
    }

    const button = el('run-simulation');
    button.disabled = true;
    setStatus('run-status', 'Simulating…', null);

    try {
        showResults(await requestSimulation());
        setStatus('run-status', '', null);
    } catch (error) {
        setStatus('run-status', error.message || 'The simulation failed.', 'error');
    } finally {
        button.disabled = false;
    }
}

/**
 * Re-runs after the scenario changed. On failure the scenario is rolled back,
 * because an over-constrained "what if" is rejected by the server and we'd
 * otherwise be left showing results that don't match the chips on screen.
 */
async function resimulate(previousForced) {
    try {
        showResults(await requestSimulation());
    } catch (error) {
        state.forced = previousForced;
        renderScenarioBar();
        if (state.payload) renderBracket(state.payload);
        window.alert(error.message || 'That scenario could not be simulated.');
    }
}

/* ------------------------------------------------------------------ */
/* Results                                                             */
/* ------------------------------------------------------------------ */

const percent = (value) => `${(value * 100).toFixed(2)}%`;

const ROUND_NAMES = { QF: 'Quarterfinal', SF: 'Semifinal', F: 'Final', W: 'Win' };
const roundHeading = (label) => ROUND_NAMES[label] || `Round ${label.slice(1)}`;

function showResults(payload) {
    state.payload = payload;
    el('setup-view').hidden = true;
    el('results-view').hidden = false;
    window.scrollTo({ top: 0 });

    const byeNote = payload.byes
        ? `, ${payload.byes} bye${payload.byes === 1 ? '' : 's'}`
        : '';
    let summary =
        `${payload.players} players in a ${payload.bracket_size}-slot bracket${byeNote} · ` +
        `best-of-${payload.best_of} matches · ` +
        `${payload.simulations.toLocaleString()} simulations` +
        (payload.seed === null ? '' : ` · seed ${payload.seed}`);

    // With a forced scenario the server throws away runs that contradict it,
    // so say how many survived -- a low acceptance rate means the remaining
    // numbers rest on a much smaller sample than requested.
    const meta = payload.meta;
    if (meta && meta.attempts > meta.kept) {
        summary += ` · conditional: kept ${meta.kept.toLocaleString()} of ` +
                   `${meta.attempts.toLocaleString()} runs ` +
                   `(${(meta.acceptance_rate * 100).toFixed(1)}% matched the scenario)`;
        if (meta.truncated) summary += ' — sample truncated, treat as rough';
    }
    el('results-summary').textContent = summary;

    renderScenarioBar();
    renderBracket(payload);
    renderTable(payload);
    state.chartStale = true;
    showTab(state.tab);
}

/* ---------- Tabs ---------- */

function showTab(name) {
    state.tab = name;
    for (const tab of document.querySelectorAll('.tab')) {
        tab.setAttribute('aria-selected', String(tab.dataset.tab === name));
    }
    for (const key of ['bracket', 'chart', 'table']) {
        el(`panel-${key}`).hidden = key !== name;
    }
    // Chart.js sizes its canvas from the container at construction time. Built
    // inside a hidden panel it measures 0x0 and locks the canvas to 0px, which
    // a later resize() can't undo -- so build it only once the panel is shown.
    if (name === 'chart' && state.chartStale && state.payload) {
        renderChart(state.payload.results);
        state.chartStale = false;
    }
}

/* ---------- Scenario ("what if") ---------- */

function forcedFor(roundIndex, matchIndex) {
    return state.forced.find((f) => f.round === roundIndex && f.match === matchIndex) || null;
}

function setForced(roundIndex, matchIndex, winnerSeed) {
    const previous = state.forced;
    state.forced = state.forced
        .filter((f) => !(f.round === roundIndex && f.match === matchIndex))
        .concat(winnerSeed === null ? [] : [{ round: roundIndex, match: matchIndex, winner: winnerSeed }]);
    resimulate(previous);
}

function renderScenarioBar() {
    const bar = el('scenario-bar');
    const list = el('scenario-list');
    bar.hidden = state.forced.length === 0;
    list.innerHTML = '';

    const nameOf = (seed) => {
        const row = (state.payload?.results || []).find((r) => r.seed === seed);
        return row ? row.name : `Seed ${seed}`;
    };

    for (const forced of state.forced) {
        const label = state.payload?.rounds?.[forced.round] ?? `R${forced.round + 1}`;
        const chip = document.createElement('span');
        chip.className = 'scenario-chip';
        chip.append(`${nameOf(forced.winner)} wins ${roundHeading(label)}`);

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = '×';
        remove.title = 'Remove this condition';
        remove.addEventListener('click', () => setForced(forced.round, forced.match, null));
        chip.append(remove);
        list.append(chip);
    }
}

/* ---------- Bracket ---------- */

const BRACKET = {
    matchWidth: 190,
    slotHeight: 25,
    gutter: 46,
    unit: 70,        // vertical pitch between round-1 matches
    titleHeight: 30,
};

const matchHeight = () => BRACKET.slotHeight * 2 + 1;

function renderBracket(payload) {
    const host = el('bracket');
    host.innerHTML = '';
    const bracket = payload.bracket;
    if (!bracket) return;

    const rounds = bracket.rounds.filter((round) => round.matches.length);
    if (!rounds.length) return;

    // Round 1 sets the vertical scale; every later round centres its matches
    // between the two it feeds from, which falls out of spacing each round's
    // matches evenly across the same total height.
    const baseCount = rounds[0].matches.length;
    const height = baseCount * BRACKET.unit;
    const columnPitch = BRACKET.matchWidth + BRACKET.gutter;

    host.style.height = `${height + BRACKET.titleHeight}px`;
    host.style.width = `${rounds.length * columnPitch + 150}px`;

    const centreY = (roundPos, matchPos) =>
        BRACKET.titleHeight + (height * (matchPos + 0.5)) / rounds[roundPos].matches.length;
    const columnX = (roundPos) => roundPos * columnPitch;

    // A match's true bracket index tells us where it feeds: bracket index m
    // always feeds index floor(m / 2) of the next round. Byes are filtered
    // out of `matches`, so map true indices back to array positions.
    const positionOf = rounds.map(
        (round) => new Map(round.matches.map((match, position) => [match.index, position]))
    );

    rounds.forEach((round, roundPos) => {
        const title = document.createElement('div');
        title.className = 'bracket-round-title';
        title.textContent = roundHeading(round.label);
        title.style.left = `${columnX(roundPos)}px`;
        title.style.width = `${BRACKET.matchWidth}px`;
        host.append(title);

        round.matches.forEach((match, matchPos) => {
            const y = centreY(roundPos, matchPos);
            host.append(buildMatch(round, match, columnX(roundPos), y));

            // Connector into the next round.
            const nextRound = rounds[roundPos + 1];
            const targetPos = nextRound
                ? positionOf[roundPos + 1].get(Math.floor(match.index / 2))
                : undefined;
            const targetY = nextRound && targetPos !== undefined
                ? centreY(roundPos + 1, targetPos)
                : (roundPos === rounds.length - 1 ? centreY(roundPos, matchPos) : null);

            if (targetY !== null && targetY !== undefined) {
                drawConnector(host, columnX(roundPos) + BRACKET.matchWidth, y, columnX(roundPos + 1), targetY);
            }
        });
    });

    // Champion box, hanging off the right of the final.
    const champion = bracket.champion[0];
    if (champion) {
        const box = document.createElement('div');
        box.className = 'bracket-champion';
        box.style.left = `${columnX(rounds.length)}px`;
        box.append(`🏆 ${champion.name}`);
        const prob = document.createElement('span');
        prob.className = 'bslot-prob';
        prob.textContent = percent(champion.probability);
        box.append(prob);
        host.append(box);
        // Centre on the final once it has a measured height.
        box.style.top = `${centreY(rounds.length - 1, 0) - box.offsetHeight / 2}px`;
    }
}

/** Horizontal stub, vertical riser, then horizontal run into the target. */
function drawConnector(host, fromX, fromY, toX, toY) {
    const midX = fromX + BRACKET.gutter / 2;
    const line = (left, top, width, height) => {
        const div = document.createElement('div');
        div.className = 'bracket-line';
        div.style.cssText =
            `left:${left}px;top:${top}px;width:${Math.max(width, 1)}px;height:${Math.max(height, 1)}px`;
        host.append(div);
    };

    line(fromX, fromY, BRACKET.gutter / 2, 1);
    if (Math.abs(toY - fromY) > 0.5) {
        line(midX, Math.min(fromY, toY), 1, Math.abs(toY - fromY));
    }
    line(midX, toY, toX - midX, 1);
}

function buildMatch(round, match, x, centreY) {
    const box = document.createElement('div');
    box.className = 'bracket-match';
    box.style.left = `${x}px`;
    box.style.top = `${centreY - matchHeight() / 2}px`;
    box.style.width = `${BRACKET.matchWidth}px`;

    const forced = forcedFor(round.index, match.index);
    if (forced) box.classList.add('has-forced');

    match.slots.forEach((candidates) => {
        box.append(buildSlot(candidates, forced));
    });

    box.addEventListener('click', () => openMatchDialog(round, match));
    return box;
}

function buildSlot(candidates, forced) {
    const slot = document.createElement('div');
    slot.className = 'bracket-slot';
    slot.style.height = `${BRACKET.slotHeight}px`;

    const top = candidates[0];
    const seed = document.createElement('span');
    seed.className = 'bslot-seed';
    const name = document.createElement('span');
    name.className = 'bslot-name';
    const prob = document.createElement('span');
    prob.className = 'bslot-prob';

    if (!top) {
        slot.classList.add('empty');
        seed.textContent = '–';
        name.textContent = 'TBD';
        prob.textContent = '';
    } else {
        seed.textContent = top.seed;
        name.textContent = top.name;
        prob.textContent = percent(top.probability);
        if (top.probability > 0.9999) slot.classList.add('certain');
        else if (top.probability >= 0.5) slot.classList.add('favourite');
        if (forced && forced.winner === top.seed) slot.classList.add('forced');
    }

    slot.append(seed, name, prob);
    return slot;
}

/* ---------- Match dialog ---------- */

async function openMatchDialog(round, match) {
    const dialog = el('match-dialog');
    const body = el('match-dialog-body');
    const [slotA, slotB] = match.slots;
    const topA = slotA[0];
    const topB = slotB[0];

    el('match-dialog-title').textContent = `${roundHeading(round.label)} — match ${match.index + 1}`;
    body.innerHTML = '';
    dialog.hidden = false;

    if (!topA || !topB) {
        body.append(Object.assign(document.createElement('p'), {
            className: 'hint',
            textContent: 'This match has no likely participants yet.',
        }));
        return;
    }

    // Head-to-head odds between the two likeliest occupants.
    const odds = document.createElement('div');
    odds.innerHTML = '<h4>If they meet</h4><p class="hint">Loading odds…</p>';
    body.append(odds);

    try {
        const response = await fetch(
            `/api/head-to-head?a=${topA.rating}&b=${topB.rating}&best_of=${state.payload.best_of}`
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);

        const matchPct = data.match_probability;
        odds.innerHTML = '<h4>If they meet</h4>';

        const bar = document.createElement('div');
        bar.className = 'odds-bar';
        const sideA = document.createElement('span');
        sideA.className = 'side-a';
        sideA.style.width = `${matchPct * 100}%`;
        sideA.textContent = `${(matchPct * 100).toFixed(1)}%`;
        const sideB = document.createElement('span');
        sideB.className = 'side-b';
        sideB.style.width = `${(1 - matchPct) * 100}%`;
        sideB.textContent = `${((1 - matchPct) * 100).toFixed(1)}%`;
        bar.append(sideA, sideB);
        odds.append(bar);

        const caption = document.createElement('p');
        caption.className = 'hint';
        caption.textContent =
            `${topA.name} (${topA.rating}) vs ${topB.name} (${topB.rating}) · ` +
            `${(data.game_probability * 100).toFixed(1)}% per game, ` +
            `${(matchPct * 100).toFixed(1)}% over a best-of-${data.best_of}. ` +
            `Longer matches favour the stronger player.`;
        odds.append(caption);
    } catch (error) {
        odds.innerHTML = `<h4>If they meet</h4><p class="status error">${error.message || 'Odds unavailable.'}</p>`;
    }

    // Who might actually be standing here.
    for (const [label, candidates] of [['Top slot', slotA], ['Bottom slot', slotB]]) {
        if (candidates.length <= 1 && candidates[0]?.probability > 0.9999) continue;
        const heading = document.createElement('h4');
        heading.textContent = `${label} — who gets here`;
        const list = document.createElement('ul');
        list.className = 'candidate-list';
        for (const candidate of candidates) {
            const item = document.createElement('li');
            item.append(`${candidate.seed}. ${candidate.name}`, Object.assign(
                document.createElement('span'), { textContent: percent(candidate.probability) }
            ));
            list.append(item);
        }
        body.append(heading, list);
    }

    // Force a result.
    const forced = forcedFor(round.index, match.index);
    const heading = document.createElement('h4');
    heading.textContent = 'What if…';
    body.append(heading);

    const note = document.createElement('p');
    note.className = 'hint';
    note.textContent = forced
        ? 'This match is currently forced. Everything else re-simulates around it.'
        : 'Pin a winner and every other number re-simulates conditional on it. Runs where that player never reaches this match are discarded.';
    body.append(note);

    const row = document.createElement('div');
    row.className = 'button-row';
    for (const candidate of [topA, topB]) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = `${candidate.name} wins`;
        if (forced && forced.winner === candidate.seed) {
            button.classList.add('primary');
            button.textContent += ' ✓';
        }
        button.addEventListener('click', () => {
            closeMatchDialog();
            setForced(round.index, match.index, candidate.seed);
        });
        row.append(button);
    }
    if (forced) {
        const clear = document.createElement('button');
        clear.type = 'button';
        clear.className = 'danger';
        clear.textContent = 'Remove condition';
        clear.addEventListener('click', () => {
            closeMatchDialog();
            setForced(round.index, match.index, null);
        });
        row.append(clear);
    }
    body.append(row);
}

function closeMatchDialog() {
    el('match-dialog').hidden = true;
}

function renderChart(results) {
    const wrap = document.querySelector('.chart-wrap');
    wrap.style.height = `${Math.max(240, results.length * 24 + 60)}px`;

    if (state.chart) state.chart.destroy();
    state.chart = new Chart(el('predictionChart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: results.map((r) => `${r.seed}. ${r.name}`),
            datasets: [{
                label: 'Win probability',
                data: results.map((r) => r.win_probability * 100),
                backgroundColor: '#2d6cdf',
                borderRadius: 3,
            }],
        },
        options: {
            indexAxis: 'y',
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (item) => `${item.parsed.x.toFixed(2)}% chance to win`,
                    },
                },
            },
            scales: {
                x: {
                    title: { display: true, text: 'Probability of winning the bracket (%)' },
                    ticks: { callback: (value) => `${value}%` },
                },
            },
        },
    });
}

function renderTable(payload) {
    const table = el('results-table');
    const columns = payload.rounds.concat(['W']);

    table.tHead.innerHTML = '';
    const headRow = table.tHead.insertRow();
    for (const heading of ['Seed', 'Player', 'Rating', ...columns.map(roundHeading)]) {
        const th = document.createElement('th');
        th.textContent = heading;
        headRow.append(th);
    }

    const body = table.tBodies[0];
    body.innerHTML = '';
    for (const result of payload.results) {
        const row = body.insertRow();
        row.insertCell().textContent = result.seed;
        row.insertCell().textContent = result.name;
        row.insertCell().textContent = result.rating;

        for (const column of columns) {
            const cell = row.insertCell();
            const value = result.round_probabilities[column];
            if (value === null || value === undefined) {
                cell.textContent = '—';
                cell.className = 'na';
            } else {
                cell.textContent = percent(value);
                if (column === 'W') cell.className = 'win-col';
            }
        }
    }
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

function buildSizeButtons() {
    const container = el('size-buttons');
    container.innerHTML = '';
    for (const size of state.config.supported_sizes) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.size = size;
        button.textContent = `${size} players`;
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', () => setPlayerCount(size));
        container.append(button);
    }
}

function buildBestOfOptions() {
    const select = el('best-of');
    select.innerHTML = '';
    for (const games of state.config.allowed_best_of) {
        const option = document.createElement('option');
        option.value = games;
        option.textContent = games === 1 ? 'Single game' : `Best of ${games}`;
        if (games === 7) option.selected = true;
        select.append(option);
    }
}

async function init() {
    try {
        const response = await fetch('/api/config');
        if (!response.ok) throw new Error(`Server returned ${response.status}.`);
        state.config = await response.json();
    } catch (error) {
        setStatus('run-status', `Couldn't reach the server: ${error.message}`, 'error');
        return;
    }

    el('default-rating-note').textContent = state.config.default_rating;
    el('simulations').max = state.config.max_simulations;
    buildSizeButtons();
    buildBestOfOptions();
    setPlayerCount(state.config.supported_sizes.includes(24) ? 24 : state.config.supported_sizes[0]);

    el('load-paste').addEventListener('click', () => loadPaste(false));
    el('append-paste').addEventListener('click', () => loadPaste(true));
    el('load-sample').addEventListener('click', loadSample);
    el('clear-roster').addEventListener('click', clearRoster);
    el('sort-by-rating').addEventListener('click', sortByRating);
    el('copy-roster').addEventListener('click', copyRoster);
    el('run-simulation').addEventListener('click', runSimulation);
    el('matchplay-import').addEventListener('click', importFromMatchPlay);
    el('back-to-setup').addEventListener('click', () => {
        el('results-view').hidden = true;
        el('setup-view').hidden = false;
        window.scrollTo({ top: 0 });
    });

    for (const tab of document.querySelectorAll('.tab')) {
        tab.addEventListener('click', () => showTab(tab.dataset.tab));
    }
    el('clear-scenario').addEventListener('click', () => {
        const previous = state.forced;
        state.forced = [];
        resimulate(previous);
    });
    el('match-dialog-close').addEventListener('click', closeMatchDialog);
    el('match-dialog').addEventListener('click', (event) => {
        if (event.target === el('match-dialog')) closeMatchDialog();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeMatchDialog();
    });
}

init();
