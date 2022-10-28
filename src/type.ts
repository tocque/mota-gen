export interface Param {
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

export type BlockId = number;

export interface KeyItem {
    value: number;
    key: BlockId;
    door: BlockId;
}

export interface ValuedItem {
    value: number;
    image: BlockId;
}

export interface Ability {
    field: "hp" | "atk" | "def" | "mdef";
    value: number;
}

export interface AbilityItem {
    value: Ability[];
    image: BlockId;
}

export interface EnemyTemplatePreset {
    name: string;
    special: number[];
    hp: number;
    atk: number;
    def: number;
}

export interface EnemyTemplate {
    preset: EnemyTemplatePreset;
    /** 随机拥有 先攻(1) 魔攻(2) 坚固(3) 二连击(4) 四种属性 */
    special: number[];
    /** 生命值成长率 */
    hp: number;
    /** 攻击力成长率 */
    atk: number;
    /** 防御力成长率 */
    def: number;
}

export interface Hero {
    atk: number;
    def: number;
    mdef: number;
}

export interface Enemy {
    special: number[];
    hp: number;
    atk: number;
    def: number;
}

export type Loc = [number, number];

export enum BlockType {
    Empty,
    Wall,
    Event,
    Stair,
}

export interface BlockBase {
    type: BlockType;
}

export interface EmptyBlock extends BlockBase {
    type: BlockType.Empty;
}

export interface WallBlock extends BlockBase {
    type: BlockType.Wall;
    breakable: boolean;
}

export interface EventBlock extends BlockBase {
    type: BlockType.Event;
    eventId: number;
}

export interface StairBlock extends BlockBase {
    type: BlockType.Stair;
    dir: "up" | "down";
}

export type Block =
    | EmptyBlock
    | WallBlock
    | EventBlock
    | StairBlock
    ;

/**
 * 房间节点类型
 */
 export enum RoomNodeType {
    Leaf,
    Cut,
    CutOfMain,
    Normal,
    Isolate,
    Source,
}

export interface Room {
    map: number;
    type: RoomNodeType,
    entry: Loc[];
    inner: Loc[];
    border: Loc[];
}

export enum RoomEntryType {
    Normal,
    SeveralForOne,
    OneForSeveral,
    SeveralForSeveral,
}

export type NormalRoomEntry = [ RoomEntryType.Normal, Loc, Loc ];
export type SeveralForOneRoomEntry = [ RoomEntryType.SeveralForOne, Loc[], Loc ];
export type OneForSeveralRoomEntry = [ RoomEntryType.OneForSeveral, Loc, Loc[] ];
export type SeveralForSeveralRoomEntry = [ RoomEntryType.SeveralForSeveral, Loc[], Loc[] ];

export type RoomEntry =
    | NormalRoomEntry
    | SeveralForOneRoomEntry
    | OneForSeveralRoomEntry
    | SeveralForSeveralRoomEntry
    ;
