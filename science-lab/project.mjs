import {icon} from './lab/icons.mjs';

const $ = id => document.getElementById(id);
for (const el of document.querySelectorAll('[data-icon]')) el.innerHTML = icon(el.dataset.icon);

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
    bar.title = `${label} · ${names[e.action]}：${e.t}–${e.end} min`;
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
  const device = active ? `温控仪正在执行${active.action === 'incubate' ? ' BCA 配板与显色' : ` NGS ${active.sample} 连接`}。` : '温控仪空闲。';
  const window = minute >= start ? `A 已于第 ${start} 分钟开始连接。` : minute <= 20 ? `A 的连接开始窗口还剩 ${20 - minute} 分钟。` : 'A 尚未开始连接，已经错过第 20 分钟的窗口。';
  $('time-note').textContent = `${device}${window}`;

  document.querySelector('.replay-verdict').classList.toggle('failed', !result.reward);
  $('verdict').textContent = result.reward ? 'PASS' : 'FAIL';
  $('duration').textContent = `${result.t} min`;
  $('start-time').textContent = `${start} / 20 min`;
  $('check-count').textContent = `${passed} / ${result.checks.length}`;
  $('verdict-note').textContent = failed.length ? '显色先占用温控仪至第 42 分钟，A 的连接开始晚于窗口 22 分钟。其他 11 项条件通过。' : '先完成两份样本的连接，再安排显色。所有交付条件满足，剩余 7 分钟。';
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
  $('replay-error').hidden = false;
  $('replay-error').textContent = `${error.message}。请通过 HTTP 静态服务器打开本页；仍可进入实验台。`;
  $('time-note').textContent = '没有可显示的回放数据。';
  $('verdict-note').textContent = '回放未加载，不作结果判断。';
}
