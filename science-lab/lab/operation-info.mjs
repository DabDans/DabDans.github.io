// Public action descriptions for the author-side browser demo.
export const operationInfo = {
  thaw: {
    device: '冰上（不占共享设备）',
    effect: '开始冰上冷却计时，10 分钟后可配液。',
    caution: '每次实验只能安排一次酶冷却。'
  },
  assay: {
    device: '检测站',
    effect: '快速检测 4 分钟、扩展检测 25 分钟后返回输入量。',
    caution: '每份样本仅测一次；快速耗 1 点，扩展耗 2 点。'
  },
  mix: {
    device: '液体处理机器人',
    effect: '消耗一份配液耗材，2 分钟后反应液就绪。',
    caution: '酶须冷却至少 10 分钟；每份样本只能配液一次。'
  },
  ligate: {
    device: '温控仪',
    effect: '占用温控仪，15 分钟后完成 20°C 连接。',
    caution: '须先完成配液；连接开始时间受样本窗口约束。'
  },
  bind: {
    device: '液体处理机器人',
    effect: '机器人操作 1 分钟，开始后 2 分钟完成结合。',
    caution: '每次实验只能开始一次磁珠结合。'
  },
  magnet: {
    device: '磁分离位',
    effect: '5 分钟后完成分离，磁分离位继续占用至开始干燥。',
    caution: '须先完成结合孵育。'
  },
  discard: {
    device: '液体处理机器人',
    effect: '占用机器人 1 分钟，弃上清后进入洗涤阶段。',
    caution: '分离未完成就弃上清，会造成不可逆材料损失。'
  },
  wash: {
    device: '液体处理机器人',
    effect: '操作 1 分钟并等待 0.5 分钟，完成一轮洗涤。',
    caution: '须先弃上清；每轮结束后才能继续，共两轮。'
  },
  dry: {
    device: '无共享设备',
    effect: '释放磁分离位，开始连续干燥计时。',
    caution: '须完成两次洗涤；演示设定干燥窗口为 10–17 分钟。'
  },
  elute: {
    device: '液体处理机器人、磁分离位',
    effect: '机器人占用 1 分钟，7 分钟后洗脱分离完成。',
    caution: '须已干燥至少 10 分钟，且两台设备均空闲。'
  },
  recover: {
    device: '液体处理机器人',
    effect: '占用机器人 1 分钟后，纯化产物完成交付。',
    caution: '须等待洗脱及再次磁分离完成。'
  },
  scout: {
    device: '检测站',
    effect: '消耗 1 点检测预算，2 分钟后返回浓度预估区间。',
    caution: '仅可在显色前安排一次；预估不代替定量报告。'
  },
  incubate: {
    device: '液体处理机器人、温控仪',
    effect: '配板 2 分钟、37°C 孵育 30 分钟后可读板。',
    caution: '反应板仅可显色一次；温控仪从配板起占用 32 分钟。'
  },
  read: {
    device: '读板仪',
    effect: '消耗 1 点预算，2 分钟后返回 562 nm 重复测量。',
    caution: '须先完成显色；全部检测共用 6 点预算。'
  },
  normalize: {
    device: '液体处理机器人',
    effect: '按输入的原浓度配制，2 分钟后交付 1 mL 样品。',
    caution: '须先取得定量报告，并输入大于零的有限浓度。'
  }
};
