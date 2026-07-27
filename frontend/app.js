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
        const response = await fetch('/api/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                players: state.players.map((p) => ({ name: p.name.trim(), rating: p.rating })),
                simulations: Number(el('simulations').value),
                best_of: Number(el('best-of').value),
                seed: el('rng-seed').value === '' ? null : Number(el('rng-seed').value),
            }),
        });

        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || `Server returned ${response.status}.`);

        showResults(payload);
        setStatus('run-status', '', null);
    } catch (error) {
        setStatus('run-status', error.message || 'The simulation failed.', 'error');
    } finally {
        button.disabled = false;
    }
}

/* ------------------------------------------------------------------ */
/* Results                                                             */
/* ------------------------------------------------------------------ */

const percent = (value) => `${(value * 100).toFixed(2)}%`;

const ROUND_NAMES = { QF: 'Quarterfinal', SF: 'Semifinal', F: 'Final', W: 'Win' };
const roundHeading = (label) => ROUND_NAMES[label] || `Round ${label.slice(1)}`;

function showResults(payload) {
    el('setup-view').hidden = true;
    el('results-view').hidden = false;
    window.scrollTo({ top: 0 });

    const byeNote = payload.byes
        ? `, ${payload.byes} bye${payload.byes === 1 ? '' : 's'}`
        : '';
    el('results-summary').textContent =
        `${payload.players} players in a ${payload.bracket_size}-slot bracket${byeNote} · ` +
        `best-of-${payload.best_of} matches · ` +
        `${payload.simulations.toLocaleString()} simulations` +
        (payload.seed === null ? '' : ` · seed ${payload.seed}`);

    renderChart(payload.results);
    renderTable(payload);
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
    el('back-to-setup').addEventListener('click', () => {
        el('results-view').hidden = true;
        el('setup-view').hidden = false;
        window.scrollTo({ top: 0 });
    });
}

init();
