import { escHtml } from './layout.js';

const MEMBERS = [
  {
    name: 'Carl',
    title: 'The Commissioner',
    stats: [
      { label: 'SHOWS UP TO MEETINGS',    value:  2, display: 'GHOST MODE'       },
      { label: 'TEXTS BACK',              value: 15, display: 'EVENTUALLY'        },
      { label: 'WHEN HE DOES TALK',       value:100, display: 'HITS DIFFERENT'    },
      { label: 'REAL TALK',                value:100, display: 'LETHAL'            },
      { label: 'SILENT INTIMIDATION',     value: 90, display: 'SOMEHOW WORKING'   },
    ],
    ability: 'Says nothing for weeks. One sentence. Everyone agrees.',
  },
  {
    name: 'Pao',
    title: 'Deputy Commissioner',
    stats: [
      { label: 'DOING EVERYTHING HIMSELF', value:100, display: 'INEVITABLE'    },
      { label: 'HOURS SLEPT',              value:  2, display: 'WHAT IS THAT'  },
      { label: 'FADEAWAY JUMPER',          value:100, display: 'SILKY'         },
      { label: 'HOLDING IT ALL TOGETHER',  value:100, display: 'SOMEHOW'       },
      { label: 'BROWSER TABS OPEN',        value:100, display: 'UNHINGED'      },
    ],
    ability: 'Gets JM\'s ideas at midnight. Builds them anyway. Unknown why.',
  },
  {
    name: 'JM',
    title: 'The Idea Guy',
    stats: [
      { label: 'IDEAS IN THE GROUP CHAT',  value:100, display: "PAO'S DM ONLY"  },
      { label: 'FACEBOOK POSTS & WRITEUPS',value:100, display: 'ON IT'          },
      { label: 'SHOOTING THE THREE',       value:100, display: '4/18. NO REGRETS'},
      { label: 'TALKING ABOUT IT',         value: 90, display: 'SELECTIVELY'    },
      { label: 'ACTUALLY BUILDING IT',     value:  2, display: 'NOT HIS DEPT.'  },
    ],
    ability: 'Has the idea. DMs Pao. Considers it shipped.',
  },
  {
    name: 'Joel',
    title: 'The Most Reliable Guy',
    stats: [
      { label: 'SHOWING UP WITH THE CAMERA', value:100, display: 'ALWAYS'      },
      { label: 'BEING DEPENDABLE',           value:100, display: 'FRIGHTENINGLY'},
      { label: 'FIRST 10 METERS OF A SPRINT',value:100, display: 'EXPLOSIVE'   },
      { label: 'EVERYTHING AFTER THAT',      value: 30, display: 'WE PRAY'     },
      { label: 'PATIENCE FOR NONSENSE',      value:  5, display: 'EXPIRED'     },
    ],
    ability: 'First to arrive, last to stop filming. Do not test him.',
  },
  {
    name: 'Paul',
    title: 'The Architect',
    stats: [
      { label: 'MAKING EVERYONE LAUGH',    value:100, display: 'EFFORTLESS'     },
      { label: 'SHOOTING FROM DOWNTOWN',   value:  3, display: 'KEEPS SHOOTING' },
      { label: 'FINISHING AT THE RIM',     value:  3, display: 'BUILDING PERMIT NEEDED'},
      { label: 'TALKING TO GIRLS',         value:100, display: 'LICENSED'       },
      { label: 'BEING AVAILABLE',          value: 50, display: 'DEPENDS'        },
    ],
    ability: 'Designs buildings worth millions. Averages 6 PPG. Shoots threes like the basket owes him money.',
  },
  {
    name: 'Mej',
    title: 'The Visual Director',
    stats: [
      { label: 'BRINGING THE CAMERA',      value:100, display: 'ESSENTIAL'      },
      { label: 'EDITING THE PHOTOS',       value:100, display: 'APPRECIATED'    },
      { label: 'CONFIDENCE IN HIMSELF',    value:100, display: 'UNSHAKEABLE'    },
      { label: 'NOT EATING RICE',          value:100, display: 'HIS WHOLE THING'},
      { label: 'SHARING HIS OPINIONS',     value:100, display: 'VERY GENEROUS'  },
    ],
    ability: 'Always has something to say, and he will say it. A true leader in that regard.',
  },
];

const SILHOUETTE = `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle cx="40" cy="40" r="40" fill="rgba(255,255,255,0.04)"/>
  <circle cx="40" cy="28" r="13" fill="rgba(255,255,255,0.15)"/>
  <ellipse cx="40" cy="68" rx="22" ry="18" fill="rgba(255,255,255,0.15)"/>
</svg>`;

function statBar(stat) {
  const fill = Math.max(2, Math.min(100, stat.value));
  const colorClass = fill >= 70 ? 'fo-stat__fill--high' : fill >= 35 ? 'fo-stat__fill--mid' : '';
  return `<div class="fo-stat">
    <div class="fo-stat__meta">
      <span class="fo-stat__label">${escHtml(stat.label)}</span>
      <span class="fo-stat__display">${escHtml(stat.display)}</span>
    </div>
    <div class="fo-stat__track">
      <div class="fo-stat__fill ${colorClass}" style="width:${fill}%"></div>
    </div>
  </div>`;
}

function memberCard(m) {
  return `<div class="fo-card">
  <div class="fo-card__avatar">${SILHOUETTE}</div>
  <div class="fo-card__name">${escHtml(m.name)}</div>
  <div class="fo-card__title">${escHtml(m.title)}</div>
  <div class="fo-card__stats">
    ${m.stats.map(statBar).join('')}
  </div>
  <div class="fo-card__ability">
    <span class="fo-ability__label">SPECIAL ABILITY</span>
    <span class="fo-ability__text">${escHtml(m.ability)}</span>
  </div>
</div>`;
}

export function frontOfficePage() {
  return `<div class="container">
  <div class="fo-header">
    <h1 class="fo-header__title">The Front Office</h1>
    <p class="fo-header__sub">The people theoretically in charge</p>
  </div>
  <div class="fo-grid">
    ${MEMBERS.map(memberCard).join('')}
  </div>
</div>`;
}
