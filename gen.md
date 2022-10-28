# 地图生成器 改二

## 输入基本参数：

```js
interface Param {
    /** 地图数量 */
    mapCount: number;
    /** 怪物数量 */
    enemyCount: number;
    enemyTemplates: EnemyTemplate;
    /** 能力增长率 */
    growthRate: number;
    /** 属性: [ 初始值, 增长基数 ] */
    initState: {
        atk: [ number, number ],
        def: [ number, number ],
        mdef: [ number, number ],
    },
    /** 属性价值 */
    ability: {
        hp: number,
        atk: number,
        def: number,
        mdef: number,
    },
    /** 属性基数 */
    pointBase: number,
    items: {
        key: KeyItem[],
        greenKey: ValuedItem,
        pickaxe: ValuedItem,
        fly: ValuedItem,
        potion: AbilityItem[],
        redJewel: AbilityItem[],
        blueJewel: AbilityItem[],
        greenJewel: AbilityItem[],
        yellowJewel: AbilityItem[],
        equips: AbilityItem[],
    },
}

type Image = [ string, number, number ];

interface KeyItem {
    value: number;
    key: Image;
    door: Image;
}

interface ValuedItem {
    value: number;
    image: Image;
}

interface Ability {
    field: "hp" | "atk" | "def" | "mdef";
    value: number;
}

interface AbilityItem {
    value: Ability[];
    image: Image;
}
```

## 生成怪物

参数需求: `enemies: number[]`

系统会按如下策略生成一系列怪物

```
special: number[] 随机拥有 魔攻 先攻 二连击 坚固 四种属性
hp: number  生命值成长率
atk: number 攻击力成长率
def: number 防御力成长率
```

随后怪物将输入怪物调参器，在这其中将执行如下步骤：

1. 将所有怪物按顺序分配到每个地图中，例如说
[ 1F, 2F, 2F, 3F, 4F, 5F, 7F ]
2. 根据数值膨胀率算出每个地图的预期角色能力值，通过调节怪物成长度将其损血量固定在一个范围内，目前经验值为一基数基础血瓶，上下浮动20%
3. 计算每个怪在所有地图的预期伤害

在生成怪物后作者需要取名并添加怪物素材

从上到下按多级进行生成：

## 地图生成

这一部分将确定整个地图的情况

### 地图标记概述

地图上的每个节点都会被标记为一种类型：

```ts
enum BlockType {
    Empty,
    Wall,
    Event,
    Stair,
}

interface BlockBase {
    type: BlockType;
}

interface EmptyBlock extends BlockBase {
    type: BlockType.Empty;
}

interface WallBlock extends BlockBase {
    type: BlockType.Wall;
    breakable: boolean;
}

interface EventBlock extends BlockBase {
    type: BlockType.Event;
    eventId: number;
}

interface StairBlock extends BlockBase {
    type: BlockType.Stair;
    dir: "up" | "down";
}

type Block =
    | EmptyBlock
    | WallBlock
    | EventBlock
    | StairBlock
    ;
```

### 楼梯生成

参数需求: `startLoc: [number, number]` 区域首层的下楼梯位置

逐层生成上下楼梯位置

### 房间生成

```ts
interface Room {
    /** 所属的map */
    map: number;
    /** 房间类型 */
    type: RoomNodeType;
    inner: Loc[];
    border: Loc[];
    entry: RoomEntry[];
}
```

#### 房间内部形状生成

按照系数在地图上划出多个不连通区域标记为房间，标记房间周围一圈为墙壁，随机打开墙壁，标记为入口

#### 房间连通

将所有房间随机进行连通，不破坏之前标记的墙壁

#### 房间分析

根据房间连接图，房间可能是不同类型的，例如说，房间可能是 起点 / 终点，或者其他叶子，割点，甚至不连通节点。

```ts
enum RoomNodeType {
    Leaf,
    Cut,
    CutOfMain,
    Normal,
    Isolate,
    Source,
    Terminal,
}
```

更进一步的，对于割点，入口存在方向，会尝试标记需要堵住的入口

这一步同样会分析房间的形状，确定入口后是否能添加守卫

- 可能的情况：多个入口向内为同一节点 / 单个入口向内有多个节点，这类入口会被标记

```ts
enum RoomEntryType {
    Normal,
    SeveralForOne,
    OneForSeveral,
}

type NormalRoomEntry = [ RoomEntryType.Normal, Loc, Loc ];
type SeveralForOneRoomEntry = [ RoomEntryType.SeveralForOne, Loc[], Loc ];
type OneForSeveralRoomEntry = [ RoomEntryType.OneForSeveral, Loc, Loc[] ];

type RoomEntry =
    | NormalRoomEntry
    | SeveralForOneRoomEntry
    | OneForSeveralRoomEntry
    ;
```

## 房间布设

### 布设装备

首先将装备随机分布在流程中，每个装备对应一个流程等级

装备的布设条件：

楼层 <= 流程等级

普通节点 > 叶节点
二入口 > 一入口

房间大小不小于2

若无满足条件的房间则直接重新进行地图生成

### 布设难度控制房间

将楼层分段

难度控制布设条件：

属于指定段落

叶节点 一入口

房间大小为3～4

若无满足条件的房间则直接重新进行地图生成

### 布设普通房间

按所在楼层，以正态分布赋予每个房间流程等级

随机生成房间价值 / 房间回报，回报基于增长系数随机

为房间分配指定价值的消耗和回报

重叠的处理：

入口同时属于多个节点，因此入口可能已经被其他房间设置过，系统会优先处理 叶节点 源汇 和 割点，这些节点的入口总属于它自己

对于其他节点，布设时不会考虑已布设的入口，因为这些节点并不一定有绝对的房间关系

## 生成BOSS层

### 生成BOSS

参数需求: `initStatus: status[]`

统计所有怪物的经验值，确定是否要在战前进行升级

统计所有的能力，确定 boss 能力的大概值并生成

### 生成BOSS层

没啥想法，为了简单考虑，此层只有咸鱼门和BOSS

设计为打败BOSS出现上楼梯比较简单

github 头像那种像素生成 作为墙壁？
