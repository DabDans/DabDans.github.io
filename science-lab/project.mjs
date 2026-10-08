import {icon} from './lab/icons.mjs';

const $ = id => document.getElementById(id);
for (const el of document.querySelectorAll('[data-icon]')) el.innerHTML = icon(el.dataset.icon);

const colorPreference = matchMedia('(prefers-color-scheme: dark)');
const isDark = () => document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : colorPreference.matches;
function syncThemeControl() {
  $('theme-toggle').textContent = isDark() ? '浅色' : '深色';
  $('theme-toggle').setAttribute('aria-label', `切换为${isDark() ? '浅色' : '深色'}主题`);
}
$('theme-toggle').hidden = false;
$('theme-toggle').addEventListener('click', () => {
  const theme = isDark() ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('pw-theme', theme); } catch {}
  syncThemeControl();
});
colorPreference.addEventListener('change', syncThemeControl);
syncThemeControl();

// This viewer reads saved author replays; it never creates or changes a live lab instance.
let replays;
let selected = 'joint_reference';
let minute = 78;
const names = {ligate:'开始连接', incubate:'配板与显色'};

function thermalSchedule(replay) {
  return replay.events.filter(e => e.action === 'ligate' || e.action === 'incubate')
    .map(e => ({...e, end:e.t + (e.action === 'ligate' ? 15 : 32)}));
}

function render() {
  const replay = replays[selected];
  const schedule = thermalSchedule(replay);
  const result = replay.result;
  const start = schedule.find(e => e.action === 'ligate' && e.sample === 'A').t;
  const passed = result.checks.filter(c => c.pass).length;
  const failed = result.checks.filter(c => !c.pass);
  for (const button of document.querySelectorAll('[data-strategy]')) {
    button.setAttribute('aria-pressed', String(button.dataset.strategy === selected));
  }

  const bars = $('thermal-bars');
  bars.replaceChildren();
  // One row per operation makes the changed order readable at narrow widths.
  for (const e of schedule) {
    const row = e.action === 'incubate' ? 2 : e.sample === 'A' ? 0 : 1;
    const bar = document.createElement('div');
    bar.className = `thermal-bar ${e.action === 'incubate' ? 'bca' : 'ngs'}${e.sample === 'A' && start > 20 ? ' late' : ''}${minute < e.t ? ' future' : ''}`;
    bar.style.cssText = `left:${e.t / 80 * 100}%;width:${(e.end - e.t) / 80 * 100}%;top:${row * 38 + 6}px`;
    const label = e.action === 'incubate' ? 'BCA' : `NGS ${e.sample}`;
    bar.title = `${label} · ${names[e.action]}：${e.t}-${e.end} min`;
    const text = document.createElement('span');
    text.textContent = label;
    bar.append(text);
    bars.append(bar);
  }
  const playhead = document.createElement('div');
  playhead.className = 'playhead';
  playhead.style.left = `${minute / 80 * 100}%`;
  bars.append(playhead);
  $('timeline').setAttribute('aria-label', `温控仪排程：${schedule.map(e => `${e.action === 'incubate' ? 'BCA' : 'NGS '+e.sample} ${e.t} 至 ${e.end} 分钟`).join('；')}。A 最迟在 20 分钟开始连接；当前查看第 ${minute} 分钟。`);

  $('replay-clock').value = `${minute} min`;
  const active = schedule.find(e => minute >= e.t && minute < e.end);
  const device = active ? `温控仪：${active.action === 'incubate' ? 'BCA 显色' : `NGS ${active.sample} 连接`}。` : '温控仪空闲。';
  const window = minute >= start ? `A 于第 ${start} 分钟开始连接。` : minute <= 20 ? `A 的连接窗口还剩 ${20 - minute} 分钟。` : 'A 已错过连接窗口。';
  $('time-note').textContent = `${device}${window}`;

  document.querySelector('.replay-verdict').classList.toggle('failed', !result.reward);
  $('verdict').textContent = result.reward ? 'PASS' : 'FAIL';
  $('duration').textContent = `${result.t} min`;
  $('start-time').textContent = `${start} / 20 min`;
  $('check-count').textContent = `${passed} / ${result.checks.length}`;
  $('verdict-note').textContent = failed.length ? `A 晚于窗口 ${start - 20} 分钟，其余 ${passed} 项通过。` : `${passed} 项条件全部满足。`;
}

for (const button of document.querySelectorAll('[data-strategy]')) {
  button.addEventListener('click', () => { selected = button.dataset.strategy; render(); });
}
$('replay-time').addEventListener('input', event => { minute = Number(event.target.value); render(); });

try {
  const response = await fetch('./lab/replays.json');
  if (!response.ok) throw new Error(`回放文件读取失败（${response.status}）`);
  replays = await response.json();
  for (const key of ['joint_reference','joint_bca_first']) {
    if (!Array.isArray(replays[key]?.events) || !Array.isArray(replays[key]?.result?.checks)) throw new Error('回放记录不完整');
  }
  render();
  for (const button of document.querySelectorAll('[data-strategy]')) button.disabled = false;
  $('replay-time').disabled = false;
} catch (error) {
  $('comparison-card').classList.add('unavailable');
  document.querySelector('.strategy-switch').classList.add('unavailable');
  $('timeline').setAttribute('aria-label', '排程回放未加载，暂不可用。');
  $('replay-error').hidden = false;
  $('replay-error').textContent = `${error.message}，请刷新重试。`;
  $('thermal-bars').replaceChildren();
  for (const id of ['verdict', 'duration', 'start-time', 'check-count']) $(id).textContent = '未加载';
  $('time-note').textContent = '回放暂不可用。';
  $('verdict-note').textContent = '回放未加载，不作结果判断。';
} finally {
  for (const el of document.querySelectorAll('.skeleton')) el.classList.remove('skeleton');
  $('comparison-card').setAttribute('aria-busy', 'false');
}
