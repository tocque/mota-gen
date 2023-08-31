import { clamp, cloneDeep, isEqual, last, minBy, partition, range, shuffle, sum, sumBy, uniq, uniqBy } from "lodash-es";
import { Direction, ILoc, Loc } from "./loc";
import { IMapLayer, MapLayer } from "./mapLayer";
import { allPairs, inArray, normalRandom, randomJudge, randomPickElement, randomPickWeightedElement, planUntil } from "./utils";
import { createDSU, paritalOrderSort } from "./algo/algo";
import { MinPriorityQueue } from '@datastructures-js/priority-queue';
import { Enemy, Hero, Values, calDamage } from "./genEnemy";
import { DoorKeyType, Gem, Potion } from "./genItem";
import { Graph } from "./algo/graph";
import { Stat } from "./algo/stat";

export enum BlockType {
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

const createEmptyBlock = (): EmptyBlock => ({ type: BlockType.Empty });

export enum WallType {
    Normal,
    Unbreak,
}

interface WallBlock extends BlockBase {
    type: BlockType.Wall;
    wallType: WallType;
}

const createWallBlock = (wallType = WallType.Normal): WallBlock => ({ type: BlockType.Wall, wallType });

export enum EventType {
    Door,
    Key,
    Enemy,
    Potion,
    Gem,
}

interface EventBase {
    type: EventType;
}

interface KeyEvent extends EventBase {
    type: EventType.Key;
    keyType: DoorKeyType;
}

const createKeyEvent = (keyType: DoorKeyType): KeyEvent => ({
    type: EventType.Key,
    keyType,
});

interface DoorEvent extends EventBase {
    type: EventType.Door;
    doorType: DoorKeyType;
}

const createDoorEvent = (doorType: DoorKeyType): DoorEvent => ({
    type: EventType.Door,
    doorType,
});

interface PotionEvent extends EventBase {
    type: EventType.Potion;
    index: number;
}

const createPotionEvent = (index: number): PotionEvent => ({
    type: EventType.Potion,
    index,
});

interface GemEvent extends EventBase {
    type: EventType.Gem;
    index: number;
}

const createGemEvent = (index: number): GemEvent => ({
    type: EventType.Gem,
    index,
});

// interface EquipEvent extends EventBase {
//     type: EventType.Door;
//     equip: Equip;
// }

interface EnemyEvent extends EventBase {
    type: EventType.Enemy;
    index: number;
}

const createEnemyEvent = (index: number): EnemyEvent => ({
    type: EventType.Enemy,
    index,
});

type Event =
    | KeyEvent
    | DoorEvent
    | PotionEvent
    | GemEvent
    | EnemyEvent

interface EventBlock extends BlockBase {
    type: BlockType.Event;
    event: Event;
}

const createEventBlock = (event: Event): EventBlock => ({ type: BlockType.Event, event });

const createKeyBlock = (keyType: DoorKeyType): EventBlock => createEventBlock(createKeyEvent(keyType));
const createDoorBlock = (doorType: DoorKeyType): EventBlock => createEventBlock(createDoorEvent(doorType));
const createPotionBlock = (index: number): EventBlock => createEventBlock(createPotionEvent(index));
const createGemBlock = (index: number): EventBlock => createEventBlock(createGemEvent(index));
const createEnemyBlock = (index: number): EventBlock => createEventBlock(createEnemyEvent(index));

export enum StairDir {
    Up = "up",
    Down = "down",
}

interface StairBlock extends BlockBase {
    type: BlockType.Stair;
    dir: StairDir;
}

const createStairBlock = (dir: StairDir): StairBlock => ({ type: BlockType.Stair, dir });

export type Block =
    | EmptyBlock
    | WallBlock
    | EventBlock
    | StairBlock
    ;

enum RoomMark {
    Empty,
    Inner,
    Border,
    Entry,
}

enum RoomStairType {
    NoStair = 0,
    DownStair = 1 << 0,
    UpStair = 1 << 1,
}

/**
 * 房间割点类型
 */
enum RoomCutType {
    Leaf,
    Cut,
    // CutOfMain,
    Normal,
    Isolate,
    // DownStair,
    // UpStair,
    // BothStair,
}

const ROOM_CUT_TYPE_MAP = {
    [RoomCutType.Leaf]: "Leaf",
    [RoomCutType.Cut]: "Cut",
    // [RoomCutType.CutOfMain]: "CutOfMain",
    [RoomCutType.Normal]: "Normal",
    [RoomCutType.Isolate]: "Isolate",
    // [RoomCutType.DownStair]: "DownStair",
    // [RoomCutType.UpStair]: "UpStair",
    // [RoomCutType.BothStair]: "BothStair",
} satisfies Record<RoomCutType, string>;

type CutBlock = [number[], number[]];

interface RoomCutMark {
    type: RoomCutType;
    blocks: CutBlock[];
}

const createRoomCutMark = (type: RoomCutType, blocks: CutBlock[]): RoomCutMark => ({
    type,
    blocks,
});

interface RoomEntry {
    id: number;
    to: number;
    loc: ILoc;
    afterLocs: ILoc[];
    belong: boolean;
}

interface StageMark {
    index: number;
    fix: number;
}

const createStageMark = (stageIndex: number, fix: number): StageMark => ({
    index: stageIndex,
    fix,
});

interface Room {
    id: number;
    stair: RoomStairType;
    entries: RoomEntry[];
    inner: ILoc[];
    stage: StageMark;
    cut: RoomCutMark;
}

enum ExpenseType {
    Door,
    Enemy,
}

enum IncomeType {
    Key,
    Gem,
    Potion,
}

type ExpensePlotBlock<T> = [ILoc, T];
type ExpenseDraftBlock = ExpensePlotBlock<ExpenseType>;
type ExpensePlanBlock = ExpensePlotBlock<Event>;
type GlobalLoc = [number, ILoc];
type IncomePlotBlock<T> = [GlobalLoc, T];
type IncomeDraftBlock = IncomePlotBlock<IncomeType[]>;
type IncomePlanBlock = IncomePlotBlock<Event>;

class ExpenseDAG<P extends [ILoc, any], T = P[1]> {

    protected blockMap: Record<string, T> = {};
    protected edgeMap: Record<string, string[]> = {};

    addBlock([loc, info]: ExpensePlotBlock<T>) {
        const locId = Loc.dump(loc);
        this.blockMap[locId] = info;
        this.edgeMap[locId] = [];
    }

    addEdge(from: ILoc, to: ILoc) {
        const fromId = Loc.dump(from);
        const toId = Loc.dump(to);
        this.edgeMap[fromId].push(toId);
    }

    listAllPath(): ExpensePlotBlock<T>[][] {
        const allIds = Object.keys(this.blockMap);
        const degreeMap: Record<string, number> = Object.fromEntries(allIds.map((e) => [e, 0]));
        allIds.forEach((id) => {
            this.edgeMap[id].forEach((to) => degreeMap[to]++);
        });
        const sources = allIds.filter((e) => degreeMap[e] === 0);
        const paths: string[][] = [];
        const dfs = (source: string) => {
            const visit = (now: string, path: string[]) => {
                const nowPath = path.concat(now);
                const edges = this.edgeMap[now];
                if (edges.length === 0) {
                    paths.push(nowPath);
                } else {
                    edges.forEach((to) => {
                        visit(to, nowPath);
                    });
                }
            };
            visit(source, []);
        };
        sources.forEach((source) => dfs(source));
        return paths.map((path) => path.map((e) => [Loc.load(e), this.blockMap[e]]));
    }

    listAllBlocks(): ExpensePlotBlock<T>[] {
        return Object.entries(this.blockMap).map(([locId, info]) => [Loc.load(locId), info]);
    }

    mapAllBlock<R>(mapper: (e: ExpensePlotBlock<T>) => ExpensePlotBlock<R>): ExpenseDAG<ExpensePlotBlock<R>> {
        const dag = new ExpenseDAG<ExpensePlotBlock<R>>();
        this.listAllBlocks().forEach((block) => {
            const [loc, info] = mapper(block);
            dag.blockMap[Loc.dump(loc)] = info;
        });
        dag.edgeMap = cloneDeep(this.edgeMap);
        return dag; 
    }
}

interface RoomPlotDraft {
    expense: ExpenseDAG<ExpenseDraftBlock>;
    income: IncomeDraftBlock[];
    ratio: number;
}
interface RoomPlotPlan {
    expense: ExpenseDAG<ExpensePlanBlock>;
    income: IncomePlanBlock[];
}

export interface MapContext {
    upStairLoc: ILoc;
    downStairLoc: ILoc;
    blockMap: IMapLayer<Block>;
    roomMap: IMapLayer<RoomMark>;
    markMap: IMapLayer<string | undefined>;
    debugMap: IMapLayer<[string, string][]>;
    venderMap: IMapLayer<string[]>;
}

const createMapContext = (): MapContext => {
    return {
        upStairLoc: [0, 0],
        downStairLoc: [0, 0],
        blockMap: MapLayer.create(() => createEmptyBlock()),
        roomMap: MapLayer.create(() => RoomMark.Empty),
        markMap: MapLayer.create(() => void 0),
        debugMap: MapLayer.create(() => []),
        venderMap: MapLayer.create(() => []),
    };
};

const debug = (mapCtx: MapContext, loc: ILoc | ILoc[], info: any, color = "#123221") => {
    MapLayer.set(mapCtx.debugMap, loc as ILoc[], (e) => e.concat([[String(info), color]]));
}

const debugVender = (mapCtx: MapContext, loc: ILoc | ILoc[], info: any) => {
    MapLayer.set(mapCtx.venderMap, loc as ILoc[], (e) => e.concat(String(info)));
}

const debugMark = (mapCtx: MapContext, loc: ILoc | ILoc[], color: string | undefined) => {
    MapLayer.set(mapCtx.markMap, loc as ILoc[], color);
}

export const statMapContext = (mapCtx: MapContext) => {
    const output: string[] = [];
    const stat = (label: string, value: any) => output.push(`${label}: ${value}`);
    {
        const { rooms } = scanRooms(mapCtx);
        const roomCount = rooms.length;
        stat("room", roomCount);
    }
    {
        let entryCount = 0;
        MapLayer.traversal(mapCtx.roomMap, (e) => {
            if (e === RoomMark.Entry) entryCount++;
        });
        stat("entry", entryCount);
    }
    {
        let doorCount = 0;
        let enemyCount = 0;
        let itemCount = 0;
        MapLayer.traversal(mapCtx.blockMap, (e) => {
            if (e.type !== BlockType.Event) return;
            const { event } = e;
            switch (event.type) {
                case EventType.Door: doorCount++; break;
                case EventType.Enemy: enemyCount++; break;
                case EventType.Key:
                case EventType.Gem:
                case EventType.Potion:
                    itemCount++; break;
            }
        });
        stat("door", doorCount);
        stat("enemy", enemyCount);
        stat("item", itemCount);
    }
    return output.join(" ");
};

/**
 * 扫描地图
 * 根据RoomMap算出地图
 */
export const scanRooms = (mapCtx: MapContext) => {

    const { roomMap } = mapCtx;

    const rooms: Room[] = [];
    const roomIdMap = MapLayer.create(() => -1);
    const [getRoomMark] = MapLayer.createAccessor(roomMap);
    const [getRoomId, setRoomId, getRoomIds] = MapLayer.createAccessor(roomIdMap);
    const roomGraph = MapLayer.buildGraphDir4(roomMap, ([fm], [tm]) => fm === tm);

    /**
     * 计算 roomIdMap 和 entry
     */
    {
        MapLayer.init(roomIdMap, () => -1);
        const blocks = roomGraph.multiSourceDFS();
        blocks.forEach((locs) => {
            if (getRoomMark(locs[0]) !== RoomMark.Inner) return;
            const roomId = rooms.length;
            setRoomId(locs, roomId);
            rooms.push({
                id: roomId,
                stair: RoomStairType.NoStair,
                entries: [],
                inner: locs,
                stage: createStageMark(0, 0),
                cut: createRoomCutMark(RoomCutType.Normal, []),
            });
        });
        
        MapLayer.traversal(roomMap, (mark, loc) => {
            if (mark !== RoomMark.Entry) return;
            const addOne = (x: number, y: number) => {
                const afterLocs = Loc.dir4(loc).filter((e) => inArray(rooms[x].inner, e));
                const entryId = rooms[x].entries.length;
                rooms[x].entries.push({
                    id: entryId, to: y, loc, belong: false, afterLocs,
                });
            }
            const roomPair = uniq(getRoomIds(Loc.dir4(loc)).filter((e) => e > -1));
            if (roomPair.length !== 2) return;
            const [x, y] = roomPair;
            addOne(x, y);
            addOne(y, x);
        });
    }

    /**
     * 楼梯分析
     */
    {
        rooms.forEach((room) => {
            const hasDownStair = inArray(room.inner, mapCtx.downStairLoc);
            const hasUpStair = inArray(room.inner, mapCtx.upStairLoc);

            let roomStairType = RoomStairType.NoStair;
            if (hasDownStair) roomStairType |= RoomStairType.DownStair;
            if (hasUpStair) roomStairType |= RoomStairType.UpStair;
            room.stair = roomStairType;
        });
    }

    /**
     * 割点分析
     */
    {
        const graph = new Graph<number, number>({
            loader: e => e, dumper: e => e
        });
        rooms.forEach((room) => {
            graph.addEdges(room.id, room.entries.map((entry) => [entry.to, void 0]));
        });

        const scanRoomCutMark = (room: Room) => {
            const blocks = graph.scanCut(room.id);
            if (blocks.length === 0) {
                return createRoomCutMark(RoomCutType.Isolate, []);
            } else if (blocks.length === 1) {
                const cutBlock = [room.entries.map((e) => e.id), blocks[0]] as CutBlock;
                if (cutBlock[0].length === 1) {
                    return createRoomCutMark(RoomCutType.Leaf, [cutBlock]);
                } else {
                    return createRoomCutMark(RoomCutType.Normal, [cutBlock]);
                }
            } else {
                const cutBlocks = blocks.map((block) => {
                    const entries = room.entries
                        .filter((entry) => block.includes(entry.to))
                        .map((e) => e.id);
                    return [entries, block] as CutBlock;
                });
                return createRoomCutMark(RoomCutType.Cut, cutBlocks);
            }
        };

        rooms.forEach((room) => {
            room.cut = scanRoomCutMark(room);
        });
    }

    return {
        rooms,
        roomIdMap,
        roomGraph,
    }
};

interface MapBaseGenOptions {
    /** 地图数量 */
    mapCount: number;
    /** 区域首层的下楼梯位置 */
    startLoc: ILoc;
}

/**
 * # 地图墙体生成
 * @param options 
 * @returns 
 */
export const genMapBase = (options: MapBaseGenOptions) => {

    const {
        mapCount,
        startLoc,
    } = options;

    const mapCtxs: MapContext[] = range(mapCount).map(() => createMapContext());
    /**
     * ## 外墙生成
     */
    {
        mapCtxs.forEach((mapCtx) => {
            const [getBlock, setBlock] = MapLayer.createAccessor(mapCtx.blockMap);
            MapLayer.traversal(mapCtx.blockMap, (origin, loc) => {
                if (MapLayer.isBorder(loc)) {
                    setBlock(loc, createWallBlock());
                }
            });

            // {
            //     const [getRoomMark, setRoomMark] = MapLayer.createAccessor(mapCtx.roomMap);
            //     const CENTER = ~~(MAP_SIZE / 2);
            //     MapLayer.traversal(mapCtx.blockMap, (block, loc) => {
            //         const [x, y] = loc;
            //         const distx = Math.abs(x - CENTER);
            //         const disty = Math.abs(y - CENTER);
            //         if (Math.max(distx, disty) > 2) return;
            //         if (Math.max(distx, disty) === 2) {
            //             if (disty === 0) {
            //                 setRoomMark(loc, RoomMark.Entry);
            //             } else {
            //                 setBlock(loc, createWallBlock());
            //             }
            //         } else {
            //             setRoomMark(loc, RoomMark.Inner);
            //         }
            //     });
            // }
        });
    }

    /**
     * ## 楼梯生成
     * 逐层生成上下楼梯位置
     * 逐次生成，保证上下楼梯对齐
     */
    {
        let lastLoc = startLoc;
        const genStairs = (mapCtx: MapContext) => {
            const [getBlock, setBlock] = MapLayer.createAccessor(mapCtx.blockMap);
            const [getRoomMark, setRoomMark] = MapLayer.createAccessor(mapCtx.roomMap);
            const downLoc = lastLoc;
            /**
             * 决定上楼为止
             * 不生成在四角上 - 很难处理
             * 对临近位置降权
             */
            const upLoc: ILoc = planUntil(() => Loc.random(), (loc) => {
                if (isEqual(loc, downLoc)) return false;
                if (getBlock(loc).type !== BlockType.Empty) return false;
                if (getRoomMark(loc) === RoomMark.Entry) return false;
                if (Loc.isNear(loc, downLoc)) {
                    if (randomJudge(0.5)) return false;
                }
                return true;
            });
            setBlock(downLoc, createStairBlock(StairDir.Down));
            setBlock(upLoc, createStairBlock(StairDir.Up));
            mapCtx.downStairLoc = downLoc;
            mapCtx.upStairLoc = upLoc;
        };
        mapCtxs.forEach((map) => {
            genStairs(map);
            lastLoc = map.upStairLoc;
        });
    }

    return mapCtxs;
};

interface MapRoomGenOptions {
    // 房间尺寸系数
    roomSizeFactor: number;
}


/**
 * # 房间生成
 * 按照系数在地图上划出多个不连通区域标记为房间，标记房间周围一圈为墙壁，随机打开墙壁，标记为入口
 * 
 * 房间节点类型也在此处标记
 */
export const genMapRoom = (_mapCtxs: MapContext[], options: MapRoomGenOptions) => {

    const mapCtxs = cloneDeep(_mapCtxs);
    const { roomSizeFactor } = options;
    
    const genRooms = (_mapCtx: MapContext) => {
    
        const mapCtx = cloneDeep(_mapCtx);
        const { downStairLoc, upStairLoc, blockMap, roomMap } = mapCtx;

        const predefinedMap = MapLayer.create(() => false);
        const [getBlock, setBlock] = MapLayer.createAccessor(blockMap);
        const [getRoomMark, setRoomMark] = MapLayer.createAccessor(roomMap);
        const [isPredefined, setPredefined] = MapLayer.createAccessor(predefinedMap);

        const isInRoom = (loc: ILoc | RoomMark) => {
            if (Array.isArray(loc)) loc = getRoomMark(loc as ILoc);
            if (loc !== RoomMark.Empty) return true;
            return false;
        };

        const isStair = (loc: ILoc) => (isEqual(loc, downStairLoc) || isEqual(loc, upStairLoc));

        MapLayer.traversal(blockMap, (e, loc) => {
            if (e.type === BlockType.Wall) {
                setRoomMark(loc, RoomMark.Border);
            }
        });

        MapLayer.traversal(roomMap, (mark, loc) => {
            if (mark !== RoomMark.Empty) {
                setPredefined(loc, true);
            }
        });

        /**
         * 创建房间
         * 
         * 从种子开始生长房间
         */
        const genRoomByGrow = (seed: ILoc) => {

            const innerLocs: ILoc[] = [];
            
            /**
             * 如果剩余的空间过少则不继续分块，防止房间过碎
             */
            const POSSIBLE_LOC_THRESHOLD = Math.trunc(5 * roomSizeFactor);
            const MINIMUM_SIZE = Math.trunc(2 * roomSizeFactor);
            const SIZE_MEAN = 3 * roomSizeFactor;
            const SIZE_STD = 1 * roomSizeFactor;

            const possibleLocs = MapLayer.buildGraphDir4(roomMap, (_, [tm]) => !isInRoom(tm)).singleSourceDFS(seed);
            if (possibleLocs.length < POSSIBLE_LOC_THRESHOLD) {
                innerLocs.push(...possibleLocs);
            } else {
                const area = clamp(normalRandom(SIZE_MEAN, SIZE_STD), MINIMUM_SIZE, possibleLocs.length);

                const expendLocs: ILoc[] = [ seed ];
                while (innerLocs.length < area && expendLocs.length > 0) {
                    const loc = randomPickWeightedElement(expendLocs, (loc) => {
                        const outDegree = Loc.dir4(loc).filter(e => isInRoom(e)).length;
                        const innerDegree = Loc.dir4(loc).filter(e => inArray(innerLocs, e)).length;
                        return outDegree * outDegree + innerDegree * innerDegree + 1;
                    }, true);
                    innerLocs.push(loc);
                    Loc.dir4(loc).forEach((loc) => {
                        if (isInRoom(loc)) return;
                        if (inArray(innerLocs, loc)) return;
                        if (inArray(expendLocs, loc)) return;
                        expendLocs.push(loc);
                    });
                }

                expendLocs.forEach((loc) => {
                    if (isStair(loc)) {
                        innerLocs.push(loc);
                    } else {
                        const nearEntry = Loc.dir4(loc).some(e => getRoomMark(e) === RoomMark.Entry);
                        if (nearEntry) {
                            innerLocs.push(loc);
                        }
                    }
                });
            }
            
            const borderLocs: ILoc[] = [];

            innerLocs.forEach((loc) => {
                Loc.dir8(loc).forEach((_loc) => {
                    if (isInRoom(_loc)) return;
                    if (inArray(innerLocs, _loc)) return;
                    if (inArray(borderLocs, _loc)) return;
                    borderLocs.push(_loc);
                });
            });

            /**
             * 如果墙壁中包括楼梯，则放弃生成
             */
            if (borderLocs.some(e => isStair(e))) {
                console.log(upStairLoc, downStairLoc, innerLocs, borderLocs, possibleLocs);
                console.log("grow room failed: stair in border");
                return;
            }

            setRoomMark(innerLocs, RoomMark.Inner);
            setRoomMark(borderLocs, RoomMark.Border);
            console.log("grow room success: max size = ", possibleLocs.length, "real size =", innerLocs.length);
        }
        
        while (!isInRoom(downStairLoc)) {
            genRoomByGrow(downStairLoc);
        }
        while (!isInRoom(upStairLoc)) {
            genRoomByGrow(upStairLoc);
        }

        while (true) {
            const blocks = MapLayer.buildGraphDir4(roomMap, ([fm], [tm]) => isInRoom(fm) === isInRoom(tm)).multiSourceDFS();
            const block = blocks.filter(e => !isInRoom(e[0]))[0];
            if (!block) break;
            const seed = randomPickWeightedElement(block, (loc) => {
                const degree = Loc.dir4(loc).filter(e => isInRoom(e)).length;
                return degree + 1;
            });
            genRoomByGrow(seed);
        }

        {
            const { roomIdMap } = scanRooms(mapCtx);
            const [getRoomId, setRoomId, getRoomIds] = MapLayer.createAccessor(roomIdMap);

            MapLayer.traversal(roomMap, (mark, loc) => {
                if (isPredefined(loc)) return;
                if (mark === RoomMark.Border) {
                    const dir4rooms = uniq(getRoomIds(Loc.dir4(loc))).filter((e) => e > -1);
                    const dir8rooms = uniq(getRoomIds(Loc.dir8(loc))).filter((e) => e > -1);
                    if (dir4rooms.length === 1 && dir8rooms.length === 1) {
                        // debug(mapCtx, loc, "x");
                        setRoomMark(loc, RoomMark.Inner);
                        setRoomId(loc, dir4rooms[0]);
                    }
                }
            });
        }

        // 生成树 + 加边 -> kruskal 即使两个集合已经相连，也有一定可能性去连边
        {
            const { rooms, roomIdMap } = scanRooms(mapCtx);
            const [getRoomId, setRoomId, getRoomIds] = MapLayer.createAccessor(roomIdMap);
            const roomCount = rooms.length;
    
            const matrix = range(roomCount).map(() => (
                range(roomCount).map(() => (
                    [] as ILoc[]
                )))
            );
            
            const degrees = Array(roomCount).fill(0);
            const edgeSet = new Set<string>();

            const linkEdge = (x: number, y: number) => {
                degrees[x]++;
                degrees[y]++;
                edgeSet.add(`${x},${y}`);
            }
    
            MapLayer.traversal(roomMap, (mark, loc) => {
                if (mark === RoomMark.Entry) {
                    const roomPair = uniq(getRoomIds(Loc.dir4(loc)).filter((e) => e > -1));
                    if (roomPair.length !== 2) return;
                    const [x, y] = [ ...roomPair ].sort((a, b) => a - b);
                    linkEdge(x, y);
                }
                if (!isPredefined(loc) && mark === RoomMark.Border) {
                    const roomPair = uniq(getRoomIds(Loc.dir4(loc)).filter((e) => e > -1));
                    if (roomPair.length !== 2) return;
                    const [x, y] = [ ...roomPair ].sort((a, b) => a - b);
                    matrix[x][y].push(loc);
                    // allPairs(vArray).forEach(([ i, j ]) => {
                    //     matrix[i][j].push(loc);
                    // });
                }
            });
            
            const { joint, isJoint } = createDSU(roomCount);

            const markEntry = (x: number, y: number) => {
                const loc = randomPickElement(matrix[x][y], true);
                if (!loc) return;
                setRoomMark(loc, RoomMark.Entry);
                linkEdge(x, y);
            }
    
            shuffle(allPairs(range(0, roomCount))).forEach(([ x, y ]) => {
                if (matrix[x][y].length === 0) return;
                if (isJoint(x, y)) {
                    if (edgeSet.has(`${x},${y}`)) {
                        if (randomJudge(0.9)) return;
                    } else if (degrees[x] > 2 || degrees[y] > 2) {
                        if (randomJudge(0.8)) return;
                    } else {
                        if (randomJudge(0.5)) return;
                    }
                    markEntry(x, y);
                } else {
                    markEntry(x, y);
                    joint(x, y);
                }
            });
        }

        /**
         * 次房间生成
         * 如果一个房间过大且存在入度为1而且不在门后的点，尝试将其分离为单独房间
         * 这步会产生特殊的门（其对于主房间不存在门背后，因为可能会有多通道）所以要放在最后做
         */
        {
            const { rooms, roomGraph } = scanRooms(mapCtx);
            rooms.forEach((room) => {
                if (isPredefined(room.inner[0])) return;
                if (room.inner.length < 6) return;
                if (room.entries.length === 0) return;
                if (room.inner.length === 6 && randomJudge(0.5)) return;
                const candidates: [ILoc, ILoc][] = [];

                const isAfterEntry = (loc: ILoc) => {
                    return room.entries.some((entry) => (
                        entry.afterLocs.length === 1 && isEqual(loc, entry.afterLocs[0]))
                    );
                };
                
                room.inner.forEach((loc) => {
                    // 上下楼梯不能被切
                    if (isStair(loc)) return;
                    if (isAfterEntry(loc)) return;
                    const neighborhoodLocs = Loc.dir4(loc).filter((e) => inArray(room.inner, e));
                    if (neighborhoodLocs.length !== 1) return;
                    const [cutLoc] = neighborhoodLocs;
                    if (isStair(cutLoc)) return;
                    if (isAfterEntry(cutLoc)) return;
                    // 暂时不考虑挡住多个点的点
                    const groups = roomGraph.scanCut(loc);
                    if (groups.length > 2) return;
                    candidates.push([loc, cutLoc]);
                });
                if (candidates.length === 0) return;
                /** @todo 应该是有先后之分的 */
                const [innerLoc, entryLoc] = randomPickElement(candidates);
                debug(mapCtx, entryLoc, "SubRoom");
                
                setRoomMark(entryLoc, RoomMark.Entry);
            });
        }

        MapLayer.traversal(roomMap, (mark, loc) => {
            if (mark === RoomMark.Border) {
                setBlock(loc, createWallBlock());
            }
        });
        
        // rooms.forEach((room) => {
        //     MapLayer.set(mapCtx.debugMap, room.inner[0], RoomTypeMap[room.type]);
        // });

        MapLayer.traversal(mapCtx.roomMap, (mark, loc) => {
            const color = {
                [RoomMark.Empty]: void 0,
                [RoomMark.Inner]: "#23783380",
                [RoomMark.Border]: void 0,
                // [RoomMark.Entry]: void 0,
                [RoomMark.Entry]: "#29B6F680",
            }[mark];
            debugMark(mapCtx, loc, color);
        });

        return mapCtx;
    }
    
    const checkRooms = (mapCtx: MapContext) => {
        const { blockMap, roomMap, downStairLoc, upStairLoc } = mapCtx;
        const { rooms, roomIdMap, roomGraph } = scanRooms(mapCtx);
        const [getBlock] = MapLayer.createAccessor(blockMap);
        const [getRoomId] = MapLayer.createAccessor(roomIdMap);
        const [getRoomMark] = MapLayer.createAccessor(roomMap);
        MapLayer.init(mapCtx.debugMap, () => []);
        /**
         * 2*2墙检查
         */
        {
            let b22 = 0;
            MapLayer.traversal(blockMap, (block, loc) => {
                /** @todo 豁免predefined的地图 */
                if (MapLayer.isConner(loc)) return;
                if (block.type === BlockType.Wall) {
                    const loc3 = Loc.dir8(loc).filter((e) => (e[0] >= loc[0] && e[1] >= loc[1]));
                    if (loc3.length === 3 && loc3.every((e) => getBlock(e).type === BlockType.Wall)) {
                        b22++;
                    }
                }
            });
            if (b22 > 0) return false;
        }
        /**
         * 上下楼梯检查
         */
        {
            const checkStair = (stairLoc: ILoc) => {
                // 如果上下楼梯被吃了，重新生成
                if (getBlock(stairLoc).type !== BlockType.Stair) {
                    return false;
                }
                const room = rooms[getRoomId(stairLoc)];
                // 如果上下楼梯割入口，且房间中存在不割入口的点，则重新生成
                const isAfterEntry = (loc: ILoc) => {
                    return room.entries.some((entry) => (
                        entry.afterLocs.length === 1 && isEqual(loc, entry.afterLocs[0]))
                    );
                }
                const isCutEntries = (loc: ILoc) => {
                    if (isAfterEntry(loc)) return true;
                    const blocks = roomGraph.scanCut(loc);
                    const blockWidthEntries = blocks.filter((block) => {
                        return block.some((loc) => isAfterEntry(loc));
                    });
                    return blockWidthEntries.length > 1;
                }
                room.inner.forEach((loc) => {
                    const blocks = roomGraph.scanCut(loc);
                    const blockWidthEntries = blocks.filter((block) => {
                        return block.some((loc) => isAfterEntry(loc));
                    });
                    debug(mapCtx, loc, blockWidthEntries.length);
                });
                if (room.inner.length > 1 && isCutEntries(stairLoc) && room.inner.some((e) => !isCutEntries(e))) {
                    return false;
                }

                return true;
            };

            if (!checkStair(upStairLoc) || !checkStair(downStairLoc)) {
                return false;
            }
        }
        /**
         * 入口检查
         */
        {
            let bad = false;
            MapLayer.traversal(roomMap, (mark, loc) => {
                if (mark !== RoomMark.Entry) return;
                const roomPair = uniq(Loc.dir4(loc).map((e) => getRoomId(e)).filter(e => e> -1));
                if (roomPair.length !== 2) {
                    bad = true;
                }
            });
            if (bad) return false;
        }
        return true;
    };

    mapCtxs.map((mapCtx, i) => {
        let retryCount = 0;
        console.groupCollapsed(`[gen] map.genRoom(#${i})`);
        let tempMapCtx: MapContext;
        do {
            console.groupCollapsed(`try time ${retryCount}`);
            tempMapCtx = genRooms(mapCtx);
            console.groupEnd();
            retryCount++;
        } while (!checkRooms(tempMapCtx));
        console.groupEnd();

        // // 对称试验
        // {
        //     tempMapCtx.blockMap = MapLayer.traversal(mapCtx.blockMap, (block, [x, y]) => {
        //         if (x > MAP_SIZE / 2) return MapLayer.get(tempMapCtx.blockMap, [MAP_SIZE - x - 1, y]);
        //         return block;
        //     });
        // }
        mapCtxs[i] = tempMapCtx;
    });

    return mapCtxs;
};

interface Status {
    hp: number,
    hero: Hero,
    keys: Record<DoorKeyType, number>,
}

interface MapPlotGenOption {
    stages: number[];
    events: {
        potions: Potion[];
        gems: Gem[];
        enemies: Enemy[];
    };
    values: Values & {
        keys: Record<DoorKeyType, number>;
        ability: {
            atk: number;
            def: number;
            mdef: number;
        }
    };
    initStatus: Status;
}

/**
 * # 物品-怪物摆放
 */
export const genMapPlot = (_mapCtxs: MapContext[], options: MapPlotGenOption) => {
    
    const mapCtxs = cloneDeep(_mapCtxs);
    const {
        stages,
        events,
        values,
        initStatus,
    } = options;

    const mapCount = mapCtxs.length;

    mapCtxs.forEach((mapCtx) => MapLayer.init(mapCtx.debugMap, () => []));
    /**
     * 整个区域建图
     */
    const roomMap: Room[][] = [];
    const graphMap: Graph<ILoc, string, number>[] = [];
    const edgeMap: Record<string, string[]> = {};
    const sourceDistMap: Record<string, number> = {};
    const termialDistMap: Record<string, number> = {};
    const allRoomIds: string[] = [];
    let sourceId: string = "";
    let termialId: string = "";
    const getRoomById = (roomId: string) => {
        const [rawMi, rawRi] = roomId.split('-');
        const mi = Number(rawMi), ri = Number(rawRi);
        const mapCtx = mapCtxs[mi];
        const room = roomMap[mi][ri];
        return [mapCtx, room, mi, ri] as const;
    };
    {
        const addEdge = (u: string, v: string) => {
            if (!(u in edgeMap)) edgeMap[u] = [];
            edgeMap[u].push(v);
        };
        let lastUpStairRoomId: string = "";
        mapCtxs.forEach((mapCtx, mi) => {
            const { rooms } = scanRooms(mapCtx);
            roomMap[mi] = rooms;
            graphMap[mi] = MapLayer.buildGraphDir4(mapCtx.roomMap, () => true);
            let upStairRoomId: string = "";
            rooms.forEach((room, ri) => {
                const roomId = `${mi}-${ri}`;
                allRoomIds.push(roomId);
                if (inArray(room.inner, mapCtx.downStairLoc)) {
                    if (lastUpStairRoomId) {
                        addEdge(roomId, lastUpStairRoomId);
                        addEdge(lastUpStairRoomId, roomId);
                    } else {
                        sourceId = roomId;
                    }
                }
                if (inArray(room.inner, mapCtx.upStairLoc)) {
                    upStairRoomId = roomId;
                }
                room.entries.forEach((entry) => {
                    addEdge(roomId, `${mi}-${entry.to}`);
                    // debug(mapCtx, entry.loc, entry.to);
                });
                debug(mapCtx, room.inner[0], ri);
            });
            lastUpStairRoomId = upStairRoomId;
        });
        termialId = lastUpStairRoomId;
    }
    const roomCount = allRoomIds.length;

    {
        const dijkstra = (source: string, distMap: Record<string, number>) => {
            interface Target {
                to: string;
                dist: number;
            }
            const pq = new MinPriorityQueue((a: Target) => a.dist);
            pq.push({ to: source, dist: 0 });

            while (!pq.isEmpty()) {
                const { to: now, dist } = pq.pop();
                if (now in distMap) continue;
                distMap[now] = dist;
                // const [mapCtx, room] = getRoomById(now);
                // debug(mapCtx, room.inner[0], `d=${dist}`);
                // console.log(now, edgeMap[now]);
                edgeMap[now].forEach((to) => {
                    pq.push({ to, dist: dist + 1 });
                });
            }
        };
        dijkstra(termialId, termialDistMap);
        dijkstra(sourceId, sourceDistMap);
    }

    /**
     * ## 划分游玩阶段
     */
    const stageMap: Record<string, number> = {};
    const allStageRoomIds: string[][] = [];
    {
        const genStage = (stageNow: number, threshold: number) => {
            let stageNowRoomIds: string[] = [];

            let maxMapId = 0;
            let minDist = termialDistMap[sourceId] + 1;
            const expendRoomIds: string[] = [];

            if (stageNow === 1) {
                expendRoomIds.push(sourceId);
            } else {
                allRoomIds.forEach((roomId) => {
                    const [_, room, mapId] = getRoomById(roomId);
                    if (room.stage.index === 0) return;
                    maxMapId = Math.max(maxMapId, mapId);
                    minDist = Math.min(minDist, termialDistMap[roomId]);
                    edgeMap[roomId].forEach((to) => {
                        const [_, toRoom] = getRoomById(to);
                        if (toRoom.stage.index === 0 && !expendRoomIds.includes(to)) {
                            expendRoomIds.push(to);
                        }
                    });
                });
            }

            while (stageNowRoomIds.length < threshold && expendRoomIds.length > 0) {
                const roomNowId = randomPickWeightedElement(expendRoomIds, (room) => {
                    const [_, __, mapId] = getRoomById(room);
                    const delta = mapCount - mapId - 1;
                    if (mapId === maxMapId && termialDistMap[room] < minDist) {
                        return delta * (expendRoomIds.length - 1) + mapCount;
                    }
                    return delta + mapCount;
                }, true);
                const addRoom = (roomId: string) => {
                    stageNowRoomIds.push(roomId);
                    const [_, __, mapNowId] = getRoomById(roomId);
                    maxMapId = Math.max(maxMapId, mapNowId);
                    minDist = Math.min(minDist, termialDistMap[roomId]);
                    // 如果该房间是上楼梯，则连上楼梯房间一并添加
                    edgeMap[roomId].forEach((to) => {
                        const [_, __, mapNextId] = getRoomById(to);
                        if (mapNextId > mapNowId) {
                            addRoom(to);
                        }
                    });
                    edgeMap[roomId].forEach((to) => {
                        if (stageNowRoomIds.includes(to)) return;
                        if (expendRoomIds.includes(to)) return;
                        const [_, room] = getRoomById(to);
                        if (room.stage.index !== 0) return;
                        expendRoomIds.push(to);
                    });
                }
                addRoom(roomNowId);
            }

            stageNowRoomIds.forEach((roomId) => {
                const [_, room] = getRoomById(roomId);
                // if (room.stage.index) console.error(room);
                room.stage.index = stageNow;
                stageMap[roomId] = stageNow;
            });
            
            allStageRoomIds.push(stageNowRoomIds);
        }
        const MARK_COLORS = ["#66BB6A80", "#FBC02D80", "#D8431580"];
        stages.forEach((stageWeight, i) => {
            const stageNow = i + 1;
            const threshold = stageNow === stages.length ? roomCount : roomCount / stages.length;
            genStage(stageNow, threshold);

            allRoomIds.forEach((roomId) => {
                const [mapCtx, room] = getRoomById(roomId);
                if (room.stage.index !== stageNow) return;
                debugMark(mapCtx, room.inner, MARK_COLORS[stageNow-1]);
            });
        });
    }

    /**
     * ## 房间定向
     * @todo 对于每个阶段分别跑一次强连通分量，处理割点
     * 暂时使用最短路形式定向，dist由大到小占据
     */
    {
        const visitedEntrySet = new Set<string>();

        const sortedRoomIds = Object.entries(sourceDistMap).sort((a, b) => {
            if (stageMap[a[0]] !== stageMap[b[0]]) return stageMap[b[0]] - stageMap[a[0]];
            return b[1] - a[1]
        }).map((e) => e[0]);

        sortedRoomIds.forEach((roomId) => {
            const [mapCtx, room, mapId, ri] = getRoomById(roomId);
            // debug(mapCtx, room.inner[0], ri);

            room.entries.forEach((entries) => {
                const entryId = `${mapId}:${Loc.dump(entries.loc)}`;
                if (visitedEntrySet.has(entryId)) return;
                entries.belong = true;
                visitedEntrySet.add(entryId);
                // debug(mapCtx, entries.loc, ri);
            });
        });
    }

    /**
     * ## 布设房间
     * 按照游玩顺序对房间排序
     */
    {
        let currentStage = 0;
        const allStageProcess = range(stages.length).map((i) => ({
            layoutedRoomCount: 0,
            totalRoomCount: allStageRoomIds[i].length,
            enemyIds: [] as number[],
        }));
        const currentStatus = cloneDeep(initStatus);

        const ALL_INCOME_TYPE = [IncomeType.Gem, IncomeType.Key, IncomeType.Potion];

        const scanDegree1EmptyLocs = (mapCtx: MapContext, room: Room, entries: RoomEntry[]) => {

            const isStair = (loc: ILoc) => (isEqual(loc, mapCtx.downStairLoc) || isEqual(loc, mapCtx.upStairLoc));

            const degree1EmptyLocs = room.inner.filter((loc) => {
                if (entries.some((entry) => inArray(entry.afterLocs, loc))) return false;
                if (isStair(loc)) return false;
                const degree = Loc.dir4(loc).filter((e) => {
                    if (!inArray(room.inner, e)) return false;
                    return true;
                }).length;
                return degree === 1;
            });

            return degree1EmptyLocs;
        }
        /**
         * ### 生成房间布局
         * 根据房间大小和形状返回一个布局方案（或者多个？）
         * @param roomId 
         * @returns 布局方案
         * expense: [ILoc, from: ILoc[]][]
         * 代价支持 1 格 / 2格 / 共用格
         * 
         * income: 
         */
        const designRoomPlotPlanDraft = (roomId: string): RoomPlotDraft => {
            const [mapCtx, room, mapId] = getRoomById(roomId);
            const { stair, entries, stage, cut } = room;

            const [getBlock] = MapLayer.createAccessor(mapCtx.blockMap);
            const graph = graphMap[mapId];

            /**
             * 是否是正则入口
             * 正则入口即左右两边都是墙的入口
             * @param loc 
             * @returns 
             */
            const isRegularEntry = (loc: ILoc) => {
                return [Direction.Up, Direction.Down].every((dir) => getBlock(Loc.dir(loc, dir)).type === BlockType.Wall)
                    || [Direction.Left, Direction.Right].every((dir) => getBlock(Loc.dir(loc, dir)).type === BlockType.Wall)
            };

            const randomExpenseType = (isDoor: number) => {
                return randomJudge(isDoor) ? ExpenseType.Door : ExpenseType.Enemy;
            };
            /**
             * 排除通向被割房间的入口
             */
            const realEntries = entries.filter((entry) => {
                if (cut.type !== RoomCutType.Cut) return true;
                const block = cut.blocks.find(([entries]) => entries.includes(entry.id))!;
                const hasDownStair = block[1].some((ri) => roomMap[mapId][ri].stair & RoomStairType.DownStair);
                return hasDownStair;
            });
            const roomArea = room.inner.length;

            const degree1EmptyLocs = scanDegree1EmptyLocs(mapCtx, room, realEntries);

            /**
             * 扫描入口信息
             */
            const realEntryMetas = realEntries.map((entry) => {
                
                const distInfo = graph.dijkstra(entry.loc, {
                    skip: (v) => !isEqual(v, entry.loc) && !inArray(room.inner, v)
                })
                    .filter((e) => !isEqual(e[0], entry.loc))
                    .map(([loc, dist]) => [loc, dist, Loc.distance(loc, entry.loc)] as const)
                const dist = distInfo
                    .sort((a, b) => {
                        if (a[1] !== b[1]) return a[1] - b[1];
                        return a[2] - b[2];
                    });

                return {
                    entry,
                    dist,
                };
            });
            /**
             * 根据房间是否有楼梯进行分类讨论
             * 上楼梯房间会包括上一层的下楼梯房间，因此下楼梯房间不需要单独布局
             */
            if (stair & RoomStairType.DownStair) {
                return {
                    expense: new ExpenseDAG,
                    income: [],
                    ratio: 1,
                };
            }
            if (stair === RoomStairType.UpStair) {

                const isDoubleExpenseRoom = realEntries.every((entry) => getBlock(entry.afterLocs[0]).type === BlockType.Empty);
                const expense = new ExpenseDAG<ExpenseDraftBlock>();

                if (isDoubleExpenseRoom) {
                    realEntries.forEach((entry) => {
                        expense.addBlock([entry.loc, randomExpenseType(1)]);
                        expense.addBlock([entry.afterLocs[0], randomExpenseType(0)]);
                        expense.addEdge(entry.loc, entry.afterLocs[0]);
                    });
                } else {
                    realEntries.forEach((entry) => {
                        expense.addBlock([entry.loc, randomExpenseType(0.5)]);
                    });
                }

                const expenseLocs = expense.listAllBlocks().map(e => e[0]);

                const attachRooms: Room[] = [];
                const allRoomDegree1EmptyLocs: GlobalLoc[] = [];
                const allDistInfo: [GlobalLoc, number, number][] = room.inner
                    .filter(e => !isEqual(e, mapCtx.upStairLoc) && !inArray(expenseLocs, e))
                    .map(e => [[mapId, e], 1, 0]);
                allRoomDegree1EmptyLocs.push(...degree1EmptyLocs.map(e => [mapId, e] as GlobalLoc));
                const attachDownStairRoom = (mapId: number) => {
                    if (mapId >= mapCount) return;
                    const mapCtx = mapCtxs[mapId];
                    const room = roomMap[mapId].find((e) => e.stair & RoomStairType.DownStair)!;
                    attachRooms.push(room);
                    const degree1EmptyLocs = scanDegree1EmptyLocs(mapCtx, room, []);
                    allRoomDegree1EmptyLocs.push(...degree1EmptyLocs.map(e => [mapId, e] as GlobalLoc));
                    const stairLoc = mapCtx.downStairLoc;

                    const distInfo = graph.dijkstra(stairLoc, {
                        skip: (v) => !isEqual(v, stairLoc) && !inArray(room.inner, v)
                    })
                        .filter((e) => !isEqual(e[0], stairLoc))
                        .map(([loc, dist]) => [[mapId, loc], dist, Loc.distance(loc,stairLoc)] as [GlobalLoc, number, number])
                    allDistInfo.push(...distInfo);
                    if (room.stair & RoomStairType.UpStair) {
                        attachDownStairRoom(mapId+1);
                    }
                };
                attachDownStairRoom(mapId+1);

                const income: IncomeDraftBlock[] = [];
                {
                    const totalAvailableArea = allDistInfo.length;
                    const incomeCount = (() => {
                        const minCount = Math.min(isDoubleExpenseRoom ? 3 : 2, totalAvailableArea);
                        const maxCount = Math.min(isDoubleExpenseRoom ? 5 : 3, totalAvailableArea);
                        return clamp(normalRandom((maxCount + minCount) / 2, (maxCount + minCount) / 6), minCount, maxCount);
                    })();
                    debug(mapCtx, room.inner[0], totalAvailableArea);
                    const candidates: GlobalLoc[] = allRoomDegree1EmptyLocs;
                    const dist = allDistInfo
                        .sort((a, b) => {
                            if (a[1] !== b[1]) return a[1] - b[1];
                            return a[2] - b[2];
                        });
                    dist.forEach(([loc]) => {
                        if (inArray(candidates, loc)) return;
                        candidates.push(loc);
                    });
                    candidates.reverse();
                    while (income.length < incomeCount) {
                        const loc = candidates.pop()!;
                        income.push([loc, ALL_INCOME_TYPE]);
                    }
                }

                return {
                    expense,
                    income,
                    ratio: normalRandom(1.4, 0.1),
                };
            } else {
    
                // 根据房间类型分类讨论 分为 房间 - 通道
                if (room.cut.type === RoomCutType.Leaf
                    || (room.cut.type === RoomCutType.Cut && realEntries.length === 1 && roomArea > 3)) {
                    const realEntryMeta = realEntryMetas[0];
                    const realEntry = realEntryMeta.entry;

                    // 考虑收入
                    const incomeCount = (() => {
                        return clamp(
                            normalRandom(roomArea / 2, roomArea / 6),
                            Math.max(degree1EmptyLocs.length, Math.ceil(roomArea / 6)),
                            roomArea
                        );
                    })();
                    const income = (() => {
                        const incomeLocs: ILoc[] = [];
                        const dist = cloneDeep(realEntryMeta.dist);
                        // dist.forEach(([loc, md, dd]) => {
                        //     debug(mapCtx, loc, `${md},${dd.toFixed(1)}`);
                        // });
                        degree1EmptyLocs.forEach((loc) => {
                            incomeLocs.push(loc);
                        });
                        while (incomeLocs.length < incomeCount) {
                            const [loc] = dist.pop()!;
                            if (inArray(incomeLocs, loc)) continue;
                            incomeLocs.push(loc);
                        }
                        return incomeLocs.map((loc) => [[mapId, loc], ALL_INCOME_TYPE] as IncomeDraftBlock);
                    })();

                    // 考虑支出
                    const leftArea = roomArea - incomeCount;
                    const isDoubleExpenseRoom = (() => {
                        if (leftArea === 0) return false;
                        if (leftArea > incomeCount) return true;
                        if (realEntryMeta.entry.afterLocs.length > 1) return false;
                        switch (incomeCount) {
                            case 1: return randomJudge(0.2);
                            case 2: return randomJudge(0.5);
                            case 3: return randomJudge(0.8);
                            default:
                                return true;
                        }
                    })();
                    const expense = new ExpenseDAG<ExpenseDraftBlock>();
                    // 考虑入口本身
                    const entryLoc = realEntry.loc;
                    // 目前如果是双支出，入口本身必定是正则的
                    if (isDoubleExpenseRoom) {
                        const afterLoc = realEntry.afterLocs[0];
                        const afterEntryIsRegular = isRegularEntry(afterLoc);
                        if (!afterEntryIsRegular) {
                            expense.addBlock([entryLoc, randomExpenseType(0.8)]);
                            expense.addBlock([afterLoc, ExpenseType.Enemy]);
                        } else if (afterEntryIsRegular) {
                            expense.addBlock([entryLoc, randomExpenseType(0.8)]);
                            expense.addBlock([afterLoc, randomExpenseType(0.3)]);
                        }
                        expense.addEdge(realEntry.loc, afterLoc);
                    } else {
                        const expenseType = (() => {
                            if (!isRegularEntry(entryLoc)) return ExpenseType.Enemy;
                            // 如果entry是正则入口，则门后必是1
                            const afterLoc = realEntry.afterLocs[0];
                            if (isRegularEntry(afterLoc)) randomExpenseType(0.5);
                            return randomExpenseType(0.8);
                        })();
                        expense.addBlock([entryLoc, expenseType]);
                    }

                    return {
                        expense,
                        income,
                        ratio: normalRandom(1.2, 0.1),
                    }
                } else {
                    // /**
                    //  * 是否是超级房间
                    //  * 超级房间：具有大量收益的房间（收益 > 3）
                    //  * 超级房间会堵弱入口
                    //  */
                    // const isSuperRoom = (() => {
                    //     if (roomArea >= 8) return true;
    
                    //     return false;
                    // })();
                    /**
                     * 根据是否拥有该入口，分为强入口和弱入口
                     * 一般情况下没有必要用弱入口
                     */
                    const [strongEntryMetas, weakEntryMetas] = partition(realEntryMetas, (e) => e.entry.belong);
                    debug(mapCtx, room.inner[0], `${strongEntryMetas.length}+${weakEntryMetas.length}`);

                    // const isRoom = weakEntryMeta.length === 0
                    //     || roomArea > 6
                    //     || (leftArea >= 3 && roomArea >= 5);
                    // 首先考虑支出
                    const expense = new ExpenseDAG<ExpenseDraftBlock>();
                    const isDoubleExpenseRoom = (() => {
                        const leftArea = roomArea - uniqBy(strongEntryMetas.map(e => e.entry.afterLocs).flat(1), Loc.dump).length;
                        if (leftArea < 2) return false;
                        if (roomArea >= 6) return true;
                        if (roomArea >= 4) return randomJudge(0.5);
                        // if (roomArea === 3) return randomJudge(0.5);
                        // if (roomArea === 2) return randomJudge(0.3);
                        return false;
                    })();

                    if (isDoubleExpenseRoom) {
                        strongEntryMetas.forEach((meta) => {
                            const { entry } = meta;
                            expense.addBlock([entry.loc, randomExpenseType(0.8)]);
                            expense.addBlock([entry.afterLocs[0], randomExpenseType(0)]);
                            expense.addEdge(entry.loc, entry.afterLocs[0]);
                        });
                    } else {
                        strongEntryMetas.forEach((meta) => {
                            const { entry } = meta;
                            expense.addBlock([entry.loc, randomExpenseType(0.4)]);
                        });
                    }

                    const expenseLocs: ILoc[] = expense.listAllBlocks().map((e) => e[0]);
                    const leftArea = roomArea + strongEntryMetas.length - expenseLocs.length;
                    

                    // 多入口时为偏序，需要拓扑排序
                    /**
                     * @todo 也加入直线距离
                     */
                    const distTupleMap: Record<string, number[]> = {};
                    {
                        room.inner.forEach((loc) => {
                            distTupleMap[Loc.dump(loc)] = [];
                        });
                        realEntryMetas.forEach((meta) => {
                            meta.dist.forEach(([loc, dist]) => {
                                console.log(Loc.dump(loc), dist);
                                distTupleMap[Loc.dump(loc)].push(dist);
                            });
                        });
                    }
                    const locGroups: ILoc[][] = paritalOrderSort(
                        room.inner.map((loc) => [loc, distTupleMap[Loc.dump(loc)]] as [ILoc, number[]]),
                        ([, da], [, db]) => da.every((e, i) => e >= db[i]) && da.some((e, i) => e > db[i])
                    ).map((e) => e.map(e => e[0]));

                    const income: IncomeDraftBlock[] = [];
                    {
                        const incomeCount = (() => {
                            // if (leftArea === 0) return 0;
                            // if (isRoom) {
                                return clamp(
                                    normalRandom(leftArea / 1.8, leftArea / 6),
                                    Math.max(degree1EmptyLocs.length, 1),
                                    leftArea
                                );
                            // } else {
                            //     if (leftArea >= 3) return Math.ceil(leftArea / 3);
                            //     return Math.max(degree1EmptyLocs.length, randomJudge(0.5) ? 1 : 0);
                            // }
                        })();
                        degree1EmptyLocs.map((loc) => {
                            income.push([[mapId, loc], ALL_INCOME_TYPE]);
                        });
                        const locs = locGroups.flat(1).reverse();
                        while (income.length < incomeCount) {
                            const loc = locs.pop()!;
                            if (inArray(degree1EmptyLocs, loc)) continue;
                            if (inArray(expenseLocs, loc)) continue;
                            income.push([[mapId, loc], ALL_INCOME_TYPE]);
                        }
                    }

                    return {
                        expense,
                        income,
                        ratio: normalRandom(1.2, 0.1),
                    };
                }
            }
        }

        const scanEventValue = (event: Event) => {
            const { enemies, potions, gems } = events;
            const { cpiFormula, keys, ability } = values;
            const cpi = cpiFormula(currentStatus.hero);
            switch (event.type) {
                case EventType.Door: {
                    return keys[event.doorType];
                }
                case EventType.Key: {
                    return keys[event.keyType];
                }
                case EventType.Gem: {
                    const gem = gems[event.index];
                    const atkValue = ability.atk * gem.atk;
                    const defValue = ability.def * gem.def;
                    const mdefValue = ability.mdef * gem.mdef;
                    return atkValue + defValue + mdefValue / cpi;
                }
                case EventType.Potion: {
                    const potion = potions[event.index];
                    return potion.hp / cpi;
                }
                case EventType.Enemy: {
                    const enemy = enemies[event.index];
                    const damage = calDamage(currentStatus.hero, enemy);
                    if (damage === null) return 1e20;
                    return damage / cpi;
                }
            }
        };
        const refineRoomPlotPlan = (draft: RoomPlotDraft): RoomPlotPlan => {

            const { base } = values;
            const { enemies, potions, gems } = events;

            const doorCandidates = [
                createDoorEvent(DoorKeyType.Blue),
                createDoorEvent(DoorKeyType.Yellow),
                createDoorEvent(DoorKeyType.Yellow),
                createDoorEvent(DoorKeyType.Yellow),
            ];

            const enemyCandidates = enemies
                .map((_, ei) => ei)
                .filter((ei) => {
                    const damage = calDamage(currentStatus.hero, enemies[ei]);
                    return damage !== null && damage > 0 && damage < base * 10;
                })
                .map((ei) => createEnemyEvent(ei));

            const randomExpenseEvent = (type: ExpenseType) => {
                switch (type) {
                    case ExpenseType.Door: {
                        return randomPickElement(doorCandidates);
                    }
                    case ExpenseType.Enemy: {
                        return randomPickElement(enemyCandidates);
                    }
                }
            };

            const randomIncomeEvent = (incomeType: IncomeType[]) => {
                const candidates: Event[] = [];
                if (incomeType.includes(IncomeType.Key)) {
                    candidates.push(
                        createKeyEvent(DoorKeyType.Blue),
                        createKeyEvent(DoorKeyType.Yellow),
                        createKeyEvent(DoorKeyType.Yellow),
                        createKeyEvent(DoorKeyType.Yellow),
                    );
                }
                if (incomeType.includes(IncomeType.Potion)) {
                    candidates.push(
                        ...potions.map((_, pi) => createPotionEvent(pi))
                    );
                }
                if (incomeType.includes(IncomeType.Gem)) {
                    candidates.push(
                        ...gems.map((_, gi) => createGemEvent(gi))
                    );
                }
                return randomPickElement(candidates);
            };

            const plans: RoomPlotPlan[] = range(9).map(() => {
                const expense = draft.expense.mapAllBlock(([loc, e]) => {
                    return [loc, randomExpenseEvent(e)];
                });
                const income = draft.income.map(([loc, e]) => {
                    return [loc, randomIncomeEvent(e)] as IncomePlanBlock;
                });

                return {
                    expense,
                    income,
                }
            });

            const calPlanScore = (plan: RoomPlotPlan) => {
                const { expense, income } = plan;
                const incomeValue = sumBy(income, (e) => scanEventValue(e[1]));

                const paths = expense.listAllPath();
                const pathValues = paths.map((path) => sumBy(path, (e) => scanEventValue(e[1])));
                const pathDeltaRatio = (pathValue: number) => {
                    const sum = pathValue * draft.ratio + incomeValue;
                    const delta = Math.abs(pathValue * draft.ratio - incomeValue);
                    return delta / sum;
                };

                if (pathValues.length === 1) {
                    return pathDeltaRatio(pathValues[0]);
                } else {
                    return Stat.variance([...pathValues.map((e) => e * draft.ratio), incomeValue]);
                }
            }

            const plan = randomPickElement(plans.toSorted((a, b) => calPlanScore(a) - calPlanScore(b)).slice(3));

            return plan;
        }
        const validateRoomPlotPlan = (roomId: string, plan: RoomPlotPlan): boolean => {
            const { expense, income } = plan;
            if (income.length === 0) return true; 
            const [mapCtx, room] = getRoomById(roomId);
            const allPaths = expense.listAllPath();
            const incomeEvents = income.map(e => e[1]);
            // debugVender(mapCtx, room.inner[0], JSON.stringify(allPaths));
            // debugVender(mapCtx, room.inner[0], JSON.stringify(income));
            // 门相关的处理
            if (allPaths.length === 1) {
                const pathEvents = allPaths[0].map(e => e[1]);
                // 门转换平衡性 - 将门和钥匙抵消后检查
                {
                    const keyDelta = {
                        [DoorKeyType.Yellow]: 0,
                        [DoorKeyType.Blue]: 0,
                        [DoorKeyType.Red]: 0,
                        [DoorKeyType.Green]: 0,
                    };
                    pathEvents.forEach((e) => {
                        if (e.type === EventType.Door) {
                            keyDelta[e.doorType]--;
                        }
                    });
                    let hasOtherIncome = false;
                    incomeEvents.forEach((e) => {
                        if (e.type === EventType.Key) {
                            keyDelta[e.keyType]++;
                        } else {
                            hasOtherIncome = true;
                        }
                    });
                    if (!hasOtherIncome) {
                        const deltaArray = Object.values(keyDelta);
                        // 如果钥匙平衡为负则显然没人换
                        if (deltaArray.every(e => e <= 0)) return false;
                        // 如果1:1换下级钥匙也是亏
                        const downSwap = deltaArray.findLastIndex(e => e > 0) < deltaArray.findIndex(e => e > 0);
                        if (downSwap && sum(deltaArray) === 0) return false;
                    }
                }
            }
            return true;
        };
        const genRoomPlot = (roomId: string) => {
            const [mapCtx, room] = getRoomById(roomId);
            const [getBlock, setBlock] = MapLayer.createAccessor(mapCtx.blockMap);

            const { income, expense } = planUntil(
                () => {
                    const draft = designRoomPlotPlanDraft(roomId);
                    const plan = refineRoomPlotPlan(draft);
                    return plan;
                },
                (plan) => validateRoomPlotPlan(roomId, plan)
            );

            debug(mapCtx, room.inner[0], `${income.length}-${expense.listAllBlocks().length}`);

            income.forEach(([[mi, loc], event]) => {
                const [getBlock, setBlock] = MapLayer.createAccessor(mapCtxs[mi].blockMap);
                const value = scanEventValue(event);
                debug(mapCtx, loc, value.toFixed(0), "green");
                setBlock(loc, createEventBlock(event));
            });

            expense.listAllBlocks().forEach(([loc, event]) => {
                const value = scanEventValue(event);
                debug(mapCtx, loc, value.toFixed(0), "red");
                setBlock(loc, createEventBlock(event));
            });
        }
        {
            let layoutedRoomCount = 0;
            const totalRoomCount = allRoomIds.length;
            const { inflation } = values;
            const inflationPoints = range(inflation.step).map((i) => (i+1) / inflation.step).reverse();
            stages.forEach((stageWeight, si) => {
                currentStage = si;
                const stageProcess = allStageProcess[currentStage];
                console.groupCollapsed(`[gen] map.genPlot(#stage${si})`);
                allStageRoomIds[si].forEach((roomId) => {
                    genRoomPlot(roomId);
                    const layoutedRoomRatio = layoutedRoomCount / totalRoomCount;
                    if (inflationPoints.length > 0 && layoutedRoomRatio > last(inflationPoints)!) {
                        inflationPoints.pop();
                        currentStatus.hero.atk += inflation.atk;
                        currentStatus.hero.def += inflation.def;
                        currentStatus.hero.mdef += inflation.mdef;
                    }
                    stageProcess.layoutedRoomCount++;
                    layoutedRoomCount++;
                });
                console.groupEnd();
            });
        }
    }

    return mapCtxs;
};
