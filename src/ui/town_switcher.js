/**
 * town_switcher.js - Multi-Town Switcher UI Component & Header Integration
 * Provides interactive segmented control for navigating between simulated towns (Clonmel & Dibrugarh).
 */

import { TOWNS, getTownConfig, DEFAULT_TOWN_ID } from '../config/towns.js';

let currentTownId = DEFAULT_TOWN_ID;
let townChangeCallback = null;

/**
 * Parses the town identifier from a URL hash string.
 * Supports formats like '#town=dibrugarh', 'town=clonmel', or '#dibrugarh'.
 * Falls back to DEFAULT_TOWN_ID ('clonmel') if not specified or unknown.
 * 
 * @param {string} hash
 * @returns {string} townId ('clonmel' | 'dibrugarh')
 */
export function parseTownFromHash(hash) {
    if (!hash || typeof hash !== 'string') {
        return DEFAULT_TOWN_ID;
    }
    const clean = hash.startsWith('#') ? hash.slice(1) : hash;
    if (!clean) {
        return DEFAULT_TOWN_ID;
    }

    try {
        const params = new URLSearchParams(clean);
        const townParam = params.get('town');
        if (townParam && TOWNS[townParam]) {
            return townParam;
        }
    } catch (_) {
        // Continue to fallback check
    }

    if (TOWNS[clean]) {
        return clean;
    }

    return DEFAULT_TOWN_ID;
}

/**
 * Generates the HTML markup for the Town Switcher segmented pill bar.
 * 
 * @param {string} [activeTownId]
 * @returns {string} HTML string
 */
export function createTownSwitcherHTML(activeTownId = currentTownId) {
    const active = TOWNS[activeTownId] ? activeTownId : DEFAULT_TOWN_ID;

    const townMeta = [
        {
            id: 'clonmel',
            flag: '🇮🇪',
            label: 'Clonmel, Ireland',
            title: 'Clonmel, Ireland (River Suir)'
        },
        {
            id: 'dibrugarh',
            flag: '🇮🇳',
            label: 'Dibrugarh, Assam',
            title: 'Dibrugarh, Assam (Brahmaputra River)'
        }
    ];

    const pillsHTML = townMeta.map(item => {
        const isActive = item.id === active;
        const btnClass = isActive ? 'town-pill-btn active' : 'town-pill-btn';
        return `<button id="town-btn-${item.id}" class="${btnClass}" data-town-id="${item.id}" type="button" role="tab" aria-selected="${isActive ? 'true' : 'false'}" title="${item.title}">
            <span class="town-pill-flag">${item.flag}</span>
            <span class="town-pill-label">${item.label}</span>
        </button>`;
    }).join('\n');

    return `<div class="town-switcher-bar" role="tablist" aria-label="Town Selection">
        ${pillsHTML}
    </div>`;
}

/**
 * Returns the currently active town ID.
 * 
 * @returns {string}
 */
export function getActiveTown() {
    return currentTownId;
}

/**
 * Sets the active town and updates UI button states and URL hash.
 * 
 * @param {string} townId
 * @param {boolean} [updateHash=true]
 * @returns {string}
 */
export function setActiveTown(townId, updateHash = true) {
    if (!TOWNS[townId]) {
        console.warn(`[town_switcher] Unknown townId "${townId}", falling back to ${DEFAULT_TOWN_ID}`);
        townId = DEFAULT_TOWN_ID;
    }
    currentTownId = townId;

    if (typeof document !== 'undefined') {
        const buttons = document.querySelectorAll ? document.querySelectorAll('.town-pill-btn') : [];
        if (buttons && buttons.length) {
            buttons.forEach(btn => {
                const btnTown = btn.getAttribute ? btn.getAttribute('data-town-id') : null;
                const isActive = btnTown === currentTownId;
                if (btn.classList) {
                    if (isActive) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                }
                if (btn.setAttribute) {
                    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
                }
            });
        }
    }

    if (updateHash && typeof window !== 'undefined' && window.location) {
        const targetHash = `town=${currentTownId}`;
        if (window.location.hash !== `#${targetHash}`) {
            window.location.hash = targetHash;
        }
    }

    return currentTownId;
}

/**
 * Initializes the town switcher UI in the DOM and registers click and hash events.
 * 
 * @param {Function} onTownChange Callback invoked with townId when selection changes
 * @returns {string} activeTownId
 */
export function initTownSwitcher(onTownChange) {
    townChangeCallback = typeof onTownChange === 'function' ? onTownChange : null;

    if (typeof window !== 'undefined' && window.location && window.location.hash) {
        currentTownId = parseTownFromHash(window.location.hash);
    }

    if (typeof document !== 'undefined') {
        const container = document.getElementById('town-switcher-container');
        if (container) {
            container.innerHTML = createTownSwitcherHTML(currentTownId);

            const buttons = (container.querySelectorAll ? container.querySelectorAll('.town-pill-btn') : null)
                || (document.querySelectorAll ? document.querySelectorAll('.town-pill-btn') : []);

            if (buttons && buttons.length) {
                buttons.forEach(btn => {
                    if (btn.addEventListener) {
                        btn.addEventListener('click', (e) => {
                            if (e && e.preventDefault) e.preventDefault();
                            const targetTown = btn.getAttribute ? btn.getAttribute('data-town-id') : null;
                            if (targetTown && targetTown !== currentTownId) {
                                setActiveTown(targetTown, true);
                                if (townChangeCallback) {
                                    townChangeCallback(currentTownId);
                                }
                            }
                        });
                    }
                });
            }
        }

        if (typeof window !== 'undefined' && window.addEventListener) {
            window.addEventListener('hashchange', () => {
                const newTown = parseTownFromHash(window.location.hash);
                if (newTown !== currentTownId) {
                    setActiveTown(newTown, false);
                    if (townChangeCallback) {
                        townChangeCallback(currentTownId);
                    }
                }
            });
        }
    }

    return currentTownId;
}
