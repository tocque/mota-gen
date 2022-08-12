import { range, inRange, isEqual, random, cloneDeep, shuffle } from "lodash-es";

type Loc = [number, number];

const SIZE = 13;

enum MapMark {
    UNKNOWN = 0,
    EMPTY = 1 << 0,

    ROOM = 1 << 1,
    ROOM_INNER = 1 << 2,
    ROOM_BORDER = 1 << 3,
    ROOM_ENTRY = 1 << 4,

    WALL = 1 << 5,
    WALL_UNBREAK = 1 << 6,

    STAIR = 1 << 8,

    EVENT = 1 << 9,

    ITEM = 1 << 10,
    ITEM_NORMAL = 1 << 11,
    ITEM_VAULED = 1 << 12,
    ITEM_IMPORTANT = 1 << 13,

    DOOR = 1 << 14,
    DOOR_1 = 1 << 15,
    DOOR_2 = 1 << 16,
    DOOR_3 = 1 << 17,

    ENEMY = 1 << 18,
    BOSS = 1 << 19,

    BASE = 1 << 20,
}

interface GenOptions {
    /** 地图数量 */
    mapCount: number;
    /** 区域首层的下楼梯位置 */
    startLoc: Loc;
    items: {
        jewel: number[],
        potion: number[],
        equip: [number, number]
    },
    growth: number,
    itemValue: {
        y_key: number,
        b_key: number,
        r_key: number,
        g_key: number,
        hp_100: number,
        atk_1: number,
        def_1: number, 
        mdef_1: number,
    },
    enemies: number[],
    initStatus: {
        atk: number,
        def: number,
    },
    params: {
        // 房间比例（百分比），决定房间的面积比例
        roomRatio: number
    }
}

/**
 * 房间节点类型
 */
enum RoomNodeType {
    Leaf,
    Cut,
    CutOfMain,
    Normal,
    Isolate,
    Source,
}

interface Room {
    type: RoomNodeType,
    entry: Loc[];
    inner: Loc[];
    border: Loc[];
}

type MapArray = number[][];

interface MapContext {
    upLoc: Loc,
    downLoc: Loc,
    rooms: Room[],
    map: MapArray;
}

function normalRandom(mean: number, std: number) {
    let u = 0.0, v = 0.0, w = 0.0, c = 0.0;
    do {

        // 获得两个（-1,1）的独立随机变量
        u = Math.random() * 2 - 1.0;
        v = Math.random() * 2 - 1.0;
        w = u * u + v * v;
    } while (w == 0.0 || w >= 1.0)
    // Box-Muller转换
    c = Math.sqrt((-2 * Math.log(w)) / w);
    const normal = mean + (u * c) * std;
    return Math.trunc(normal);
}

function randomPickElement<T>(array: T[], remove = false): T {
    const id = random(0, array.length-1);
    const elm = array[id];
    if (remove) array.splice(id, 1);
    return elm;
}

function allPairs<T>(array: T[]): [ T, T ][] {
    const pairs: [ T, T ][] = [];
    array.forEach((ei, i) => {
        array.forEach((ej, j) => {
            if (i >= j) return;
            pairs.push([ ei, ej ]);
        })
    })
    return pairs;
}

function inArray<T>(array: T[], elm: T) {
    return array.some((_elm) => isEqual(elm, _elm));
}

function printMap(mapCtx: MapContext) {
    const rows: string[] = [];
    for (const row of mapCtx.map) {
        rows.push(row.map((e) => {
            switch (e) {
                case (e | MapMark.STAIR): return '{}';
                case (e | MapMark.ITEM_IMPORTANT): return '@@';
                case (e | MapMark.ROOM_ENTRY): return '||';
                case (e | MapMark.WALL_UNBREAK): return '##';
                case (e | MapMark.WALL): return '██';
                default: return '░░';
            }
        }).join(''));
    }

    console.log(rows.join('\n'));
}

function createDisjointSet(size: number) {
    const pa = range(size);

    const findpa = (x: number): number => (x === pa[x] ? x : pa[x] = findpa(pa[x]));

    const isJoint = (x: number, y: number) => findpa(x) === findpa(y);

    const joint = (x: number, y: number) => pa[findpa(x)] = findpa(y);

    return {
        isJoint,
        joint,
    }
}

export function gen(options: GenOptions): MapContext[] {

    const {
        mapCount,
        startLoc,
        items,
        enemies,
        initStatus,
        params,
    } = options;

    const maps: MapContext[] = [];

    /**
     * # 地图生成
     */

    /**
     * ## 楼梯生成
     * 逐层生成上下楼梯位置
     * 逐次生成，保证上下楼梯对齐
     */

    {
        console.groupCollapsed("[gen] map.stair");
        let lastLoc = startLoc;
        range(mapCount-1).forEach(() => {
            const map = createMap(lastLoc);
            maps.push(map);
            lastLoc = map.upLoc;
            printMap(map);
        })
        console.groupEnd();
    }

    /**
     * ## 房间生成
     * 按照系数在地图上划出多个不连通区域标记为房间，标记房间周围一圈为墙壁，随机打开墙壁，标记为入口
     * 
     * 房间节点类型也在此处标记
     */

    {
        console.groupCollapsed("[gen] map.rooms");
        maps.forEach((map) => {
            createRooms(map);
            printMap(map);
        })
        console.groupEnd();
    }

    /**
     * ## 地图完全生成
     * 将所有房间随机进行连通，不破坏之前标记的墙壁
     * @deprecated 这一步摸了，因为生成房间已经基本搞好了
     */

    /**
     * ## 怪物生成
     * 
     * 策略：根据攻防配比
     */

    /**
     * ## 标记房间重要性 ～ 填充物品 - 怪物
     * 
     * 策略：
     *  - 怪物总在通道上或者通道向内一格
     *  - 多通道时考虑 蓝钥匙 / 强怪 / 弱怪 + 黄钥匙 等多种组合
     * 可以估算收益值，尽量做到收益和消耗匹配（反正总会漏 
     * 
     * ### 关键房间
     * 剑盾各一个 难度控制房间 5层一个
     * 特征：
     *  - 通道数：
     *      剑盾优先考虑双通道[咸鱼+正常搞]
     *      难度控制房间优先考虑单通道
     *  - 节点类型：
     *     叶节点 > 普通节点 > 割点 > 上下楼梯割点 > 不可入节点
     *  - 空间：
     *     至少有2
     * 内容：
     *  - 墙壁设置为不可破
     *  - 难度控制房间 - 绿门 + 高价值宝石
     *  - 剑盾 - [ (红门 | 绿门) + (强怪 | 蓝门) * 3 ] 装备 + 血瓶填充
     * 
     * ### 高价值房间
     * 红钥匙 高价值宝石 破 飞
     * 特征：
     *  - 基本上是关键房间的次选
     *  - 进不去的房间
     * 内容：
     *  - [ 强怪 ｜ 绿门 ]
     * ### 中价值房间
     * 中价值宝石 血瓶 蓝钥匙，大量低价值物品
     * 特征：
     *  - 基本上是高价值房间的次选，但是割点次于上下楼梯割点
     * ### 低价值房间
     * 小宝石 血瓶 黄钥匙
     * 特征：
     *  - 挑剩的 
     * ### 关卡
     * 强敌卡你
     * 特征：
     *  - 优先考虑上下楼梯割点
     * 呃呃，感觉可以搞打分函数
     */
    fillRooms(maps);

    /**
     * # 生成BOSS层
     * BOSS层单独生成
     *  - 随机生成咸鱼门
     *  - 左右或者上下对称
     *  - 有规则图案
     */

    return maps;

    function createMapArray(initValue: number): MapArray {
        return range(SIZE).map(() => Array(SIZE).fill(initValue) as number[]);
    }

    function traversalMapArray(map: MapArray, visitor: (loc: Loc, value: number) => any) {
        map.forEach((row, y) => {
            row.forEach((value, x) => {
                visitor([ x, y ], value);
            })
        })
    }

    function mark(map: MapArray, [ x, y ]: Loc, value: number) {
        map[y][x] |= value;
    }

    function unmark(map: MapArray, [ x, y ]: Loc, value: number) {
        map[y][x] &= (map[y][x] ^ value);
    }

    function batchMark(map: MapArray, locs: Loc[], value: number) {
        locs.forEach((loc) => {
            mark(map, loc, value);
        })
    }

    function getMark(map: MapArray, [ x, y ]: Loc) {
        return map[y][x];
    }

    function isMark(map: MapArray, loc: Loc, value: number) {
        return (getMark(map, loc) & value) !== 0;
    }

    function up([ x, y ]: Loc): Loc {
        return [ x, y-1 ];
    }

    function down([ x, y ]: Loc): Loc {
        return [ x, y+1 ];
    }

    function left([ x, y ]: Loc): Loc {
        return [ x-1, y ];
    }

    function right([ x, y ]: Loc): Loc {
        return [ x+1, y ];
    }

    function fourDir(loc: Loc): Loc[] {
        return [ up(loc), down(loc), left(loc), right(loc) ];
    }

    function isVaildLoc([ x, y ]: Loc) {
        return inRange(x, 0, SIZE) && inRange(y, 0, SIZE);
    }

    function isMapBorderLoc([ x, y ]: Loc) {
        return x === 0 || x === SIZE - 1 || y === 0 || y === SIZE - 1;
    }

    function randomLoc(): Loc {
        return [ random(SIZE-1), random(SIZE-1) ];
    }

    function randomLocUtil(vaildator: (loc: Loc) => boolean): Loc {
        let loc = randomLoc();
        while (!vaildator(loc)) {
            loc = randomLoc();
        }
        return loc;
    }

    function createMap(_downLoc: Loc): MapContext {

        const map = createMapArray(MapMark.UNKNOWN);
        const downLoc = cloneDeep(_downLoc);
        /**
         * 不生成在四角上 - 很难处理
         */
        const upLoc: Loc = randomLocUtil((loc) => {
            if (isEqual(loc, downLoc)) return false;
            if (isEqual(loc, [ 0, 0 ])) return false;
            if (isEqual(loc, [ 0, SIZE-1 ])) return false;
            if (isEqual(loc, [ SIZE-1, 0 ])) return false;
            if (isEqual(loc, [ SIZE-1, SIZE-1 ])) return false;
            if (fourDir(loc).some((_loc) => isEqual(_loc, downLoc))) {
                if (random(2) !== 0) return false;
            }
            return true;
        });

        mark(map, downLoc, MapMark.STAIR);
        mark(map, upLoc, MapMark.STAIR);

        traversalMapArray(map, (loc) => {
            if (!isMapBorderLoc(loc)) return;
            if (isMark(map, loc, MapMark.STAIR)) return;
            mark(map, loc, MapMark.WALL);
        });

        return {
            downLoc,
            upLoc,
            map,
            rooms: [],
        }
    }

    function createRooms(mapCtx: MapContext) {
        
        const { map } = mapCtx;

        // 房间面积阈值（包括外墙），会浮动
        // const areaThreshold = Math.min(
        //     (params.roomRatio * SIZE * SIZE / 100) * random(80, 120) / 100, SIZE * SIZE
        // );
        const areaThreshold = SIZE * SIZE * 0.95;
        let nowArea = 0;
        // console.log("areaThreshold =", areaThreshold);

        const roomArray = createMapArray(0);

        // @ts-ignore
        const rooms: Room[] = [void 0];
        let roomId = 0;

        const isInRoom = (loc: Loc) => {
            if (isMark(map, loc, MapMark.ROOM)) return true;
            return false;
        }

        const createRoom = (seed: Loc) => {
            roomId++;
            const area = Math.max(normalRandom(4, 2), 2);
            // console.log("seed =", seed, "innerArea =", area);

            const innerLocs: Loc[] = [];
            const expendLocs: Loc[] = [ seed ];
            const borderLocs: Loc[] = [];

            while (innerLocs.length < area && expendLocs.length > 0) {
                const loc = randomPickElement(expendLocs, true);
                innerLocs.push(loc);
                mark(map, loc, MapMark.ROOM | MapMark.ROOM_INNER);
                fourDir(loc)
                    .filter((loc) => {
                        if (!isVaildLoc(loc)) return false;
                        if (isMapBorderLoc(loc)) return;
                        if (isInRoom(loc)) return false;
                        return true;
                    })
                    .forEach((loc) => {
                        if (inArray(innerLocs, loc)) return;
                        if (inArray(expendLocs, loc)) return;
                        expendLocs.push(loc);
                    })
            }

            innerLocs.forEach((loc) => {
                fourDir(loc)
                    .forEach((loc) => {
                        if (!isVaildLoc(loc)) return;
                        if (inArray(innerLocs, loc)) return;
                        if (isMark(map, loc, MapMark.STAIR)) {
                            innerLocs.push(loc);
                        }
                    })
            })

            innerLocs.forEach((loc) => {
                mark(roomArray, loc, roomId);
                fourDir(loc)
                    .forEach((loc) => {
                        if (!isVaildLoc(loc)) return;
                        if (isMark(map, loc, MapMark.ROOM_INNER)) return;
                        if (inArray(borderLocs, loc)) return;
                        borderLocs.push(loc);
                    })
            })

            batchMark(map, borderLocs, MapMark.ROOM | MapMark.ROOM_BORDER | MapMark.WALL);

            nowArea += borderLocs.length + innerLocs.length;

            rooms.push({
                type: RoomNodeType.Normal,
                entry: [],
                inner: innerLocs,
                border: borderLocs,
            });
        }

        let inSameRoom = true;
        createRoom(mapCtx.downLoc);
        if (!isMark(map, mapCtx.upLoc, MapMark.ROOM)) {
            createRoom(mapCtx.upLoc);
            inSameRoom = false;
        }

        while (nowArea < areaThreshold) {
            const seed = randomLocUtil((loc) => {
                if (isMapBorderLoc(loc)) return false;
                if (isInRoom(loc)) return false;
                return true;
            });
            createRoom(seed);
        }

        traversalMapArray(map, (loc) => {
            if (getMark(roomArray, loc) > 0) return;
            if (isMark(map, loc, MapMark.ROOM)) return;
            roomId++;
            const innerLocs: Loc[] = [];
            const borderLocs: Loc[] = [];
            const dfs = (loc: Loc) => {
                if (getMark(roomArray, loc) > 0) return;
                if (isMark(map, loc, MapMark.WALL)) return;
                mark(roomArray, loc, roomId);
                innerLocs.push(loc);
                fourDir(loc)
                    .forEach((loc) => {
                        if (!isVaildLoc(loc)) return;
                        dfs(loc);
                    })
            };
            dfs(loc);
            batchMark(map, innerLocs, MapMark.ROOM_INNER);

            innerLocs.forEach((loc) => {
                mark(roomArray, loc, roomId);
                fourDir(loc)
                    .forEach((loc) => {
                        if (!isVaildLoc(loc)) return;
                        if (isMark(map, loc, MapMark.ROOM_INNER)) return;
                        if (inArray(borderLocs, loc)) return;
                        borderLocs.push(loc);
                    })
            })

            batchMark(map, borderLocs, MapMark.ROOM | MapMark.ROOM_BORDER | MapMark.WALL);

            rooms.push({
                type: RoomNodeType.Normal,
                entry: [],
                inner: innerLocs,
                border: borderLocs,
            });
        });

        const roomCnt = roomId;

        const matrix = range(roomCnt + 1).map(() => (
            range(roomCnt + 1).map(() => (
                [] as Loc[]
            )))
        );

        traversalMapArray(map, (loc, value) => {
            if (!(value & MapMark.ROOM_BORDER)) return;
            if (isMapBorderLoc(loc)) return;
            const vSet = new Set<number>();
            fourDir(loc)
                .forEach((loc) => {
                    if (!isVaildLoc(loc)) return;
                    const belong = getMark(roomArray, loc);
                    if (belong > 0) vSet.add(belong);
                });
            const vArray = [ ...vSet.values() ].sort((a, b) => a - b);
            allPairs(vArray).forEach(([ i, j ]) => {
                matrix[i][j].push(loc);
            });
        });

        // 生成树 + 加边 -> kruskal 即使两个集合已经相连，也有一定可能性去连边 [10%]
        {
            const { joint, isJoint } = createDisjointSet(roomCnt + 1);

            const linkEdge = (x: number, y: number) => {
                const loc = randomPickElement(matrix[x][y]);
                mark(map, loc, MapMark.ROOM_ENTRY);
                unmark(map, loc, MapMark.ROOM_BORDER | MapMark.WALL);
            }
    
            shuffle(allPairs(range(1, roomCnt + 1))).forEach(([ x, y ]) => {
                if (matrix[x][y].length === 0) return;
                if (isJoint(x, y)) {
                    if (random(8) === 0) {
                        linkEdge(x, y);
                    }
                    return;
                }
                linkEdge(x, y);
                joint(x, y);
            });
        }

        const edgeSets = range(roomCnt+1).map(() => new Set<number>());

        traversalMapArray(map, (loc, value) => {
            if (!(value & MapMark.ROOM_ENTRY)) return;
            const vSet = new Set<number>();
            fourDir(loc)
                .forEach((loc) => {
                    if (!isVaildLoc(loc)) return;
                    const belong = getMark(roomArray, loc);
                    if (belong > 0) vSet.add(belong);
                });
            const vArray = [ ...vSet.values() ].sort((a, b) => a - b);
            vArray.forEach((i) => {
                rooms[i].entry.push(loc);
            });
            allPairs(vArray).forEach(([ i, j ]) => {
                edgeSets[i].add(j);
                edgeSets[j].add(i);
            });
        });

        {
            const dfn = Array(roomCnt+1).fill(0), low = Array(roomCnt+1).fill(0);
            let idx = 0;
            const tarjan = (u: number, p: number) => {
                dfn[u] = low[u] = ++idx;
                for (const v of edgeSets[u]) {
                    if (v == p)
                        continue;
                    if (!dfn[v]) {
                        tarjan(v, u);
                        low[u] = Math.min(low[u], low[v]);
                        if (low[v] >= dfn[u]) {
                            /**
                             * @todo CutOfMain 摸了
                             */
                            rooms[u].type = RoomNodeType.Cut;
                        }
                    } else {
                        low[u] = Math.min(low[u], dfn[v]);
                    }
                }
            }
            tarjan(1, -1);

            edgeSets.forEach((edgeSet, i) => {
                if (i === 0) return;
                if (edgeSet.size === 1) {
                    rooms[i].type = RoomNodeType.Leaf;
                } else if ( edgeSet.size === 0) {
                    rooms[i].type = RoomNodeType.Isolate;
                }
            })

            rooms[1].type = RoomNodeType.Source;
            if (!inSameRoom) {
                rooms[2].type = RoomNodeType.Source;
            }
        }
        

        mapCtx.rooms = rooms.slice(1);
    }

    function fillRooms(maps: MapContext[]) {

        const rooms: [number, number, Room][] = [];

        maps.forEach((map, i) => {
            rooms.push(...map.rooms.map((e) => [ i, 0, e ] as [ number, number, Room ]));
        })

        /**
         * 首先填充剑盾
         */
        {
            // 对房间打分
            rooms.forEach((room) => {
                let score = 0;
                const [ floor, , { type, entry, inner } ] = room;
                score += floor * 1;
                score += random(0, 10);
                // 节点类型
                switch (type) {
                    case RoomNodeType.Leaf: score += 40; break;
                    case RoomNodeType.Normal: score += 20; break;
                    case RoomNodeType.Cut: score += 0; break;
                    case RoomNodeType.Source:
                    case RoomNodeType.Isolate:
                    case RoomNodeType.CutOfMain:
                        score -= 100; break;
                }
                const entryCount = entry.length;
                switch (entryCount) {
                    case 2:
                        score += 20; break;
                    case 1:
                        score += 0; break;
                    default:
                        score -= 100; break;
                }
                const innerCount = inner.length;
                switch (innerCount) {
                    case 4: case 5: case 6:
                        score += 20; break;
                    case 3:
                        score += 10; break;
                    case 2:
                        score += 0; break;
                    default:
                        score -= 100; break;
                }
                room[1] = score;
            });

            rooms.sort((a, b) => a[1] - b[1]);
            const sword = rooms.pop()!;
            const shield = rooms.pop()!;

            batchMark(maps[sword[0]].map, sword[2].inner, MapMark.ITEM_IMPORTANT);
            batchMark(maps[shield[0]].map, shield[2].inner, MapMark.ITEM_IMPORTANT);

            printMap(maps[sword[0]]);
            printMap(maps[shield[0]]);
        }

        /**
         * 难度控制房间
         */
        {
            // 对房间打分
            rooms.forEach((room) => {
                let score = 0;
                const [ floor, , { type, entry, inner } ] = room;
                score += floor * 1;
                score += random(0, 10);
                // 节点类型
                switch (type) {
                    case RoomNodeType.Leaf: score += 40; break;
                    case RoomNodeType.Normal: score += 20; break;
                    case RoomNodeType.Cut: score += 0; break;
                    case RoomNodeType.Source:
                    case RoomNodeType.Isolate:
                    case RoomNodeType.CutOfMain:
                        score -= 100; break;
                }
                const entryCount = entry.length;
                switch (entryCount) {
                    case 1:
                        score += 20; break;
                    case 0:
                        score += 0; break;
                    default:
                        score -= 100; break;
                }
                const innerCount = inner.length;
                switch (innerCount) {
                    case 4:
                        score += 20; break;
                    case 3:
                        score += 10; break;
                    case 2:
                        score += 0; break;
                    default:
                        score -= 100; break;
                }
                room[1] = score;
            });

            rooms.sort((a, b) => a[1] - b[1]);
            const need = Math.trunc(mapCount / 4);

            range(0, need).forEach(() => {
                const room = rooms.pop()!;
                batchMark(maps[room[0]].map, room[2].border, MapMark.WALL_UNBREAK);
                printMap(maps[room[0]]);
            })
        }

        /**
         * 对剩下的房间进行分类并填充
         */
        {

        }
    }
}
