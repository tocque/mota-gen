import { decodeBase64, encodeBase64, readFile, writeFile } from "./fs";
import { ViewTile, ViewTileType, drawTile } from "@/view/tile";
import { MAP_SIZE, TILE_SIZE } from "@/gen/const";
import { noop, range } from "lodash-es";
import { ProjectData } from "@/gen/type";
import { MapLayer } from "@/gen/mapLayer";
import { Block, BlockType, EventType, StairDir, WallType } from "@/gen/genMap";
import { DoorKeyType } from "@/gen/genItem";
import { loadImage } from "@/view/utils";
import { createLogger } from "@/utils/logger";
import { Loc } from "@/gen/loc";

type DataFileMeta = [name: string, prefix: string, beautify?: boolean];

const DATA_FILE_MAP = {
    data: ["data", "data_a1e2fb4a_e986_4524_b0da_9b7ba7c0874d"],
    maps: ["maps", "maps_90f36752_8815_4be8_b32b_d7fad1d0542e", true],
    icons: ["icons", "icons_4665ee12_3a1f_44a4_bea3_0fccba634dc1"],
    items: ["items", "items_296f5d02_12fd_4166_a7c1_b5e830c9ee3a"],
    enemies: ["enemys", "enemys_fcae963b_31c9_42b4_b48c_bb48d09f3f80", true],
} satisfies Record<string, DataFileMeta>;

type FileData = Record<string, any>;

const INDENT = " ".repeat(4);

const beautifyFileDataJSON = (data: FileData) => {
    const lines = Object.entries(data).map(([k, v]) => `${INDENT}"${k}": ${JSON.stringify(v)}`).join(",\n");
    return ['{', lines, '}'].join('\n');
}

const loadDataFile = async (file: DataFileMeta): Promise<FileData> => {

    const [filename] = file;
    const oriRawData = decodeBase64(await readFile(`project/${filename}.js`));
    const [prefixLine, ...dataLines] = oriRawData.split('\n');
    const oriData = JSON.parse(dataLines.join('')) as FileData;

    return oriData;
}

const outputDataFile = async (file: DataFileMeta, data: FileData) => {

    const [filename, prefix, beautify] = file;

    const dataJSON = beautify ? beautifyFileDataJSON(data) : JSON.stringify(data, null, 4);

    const fileContent = `var ${prefix} =\n${dataJSON}`;

    await writeFile(`project/${filename}.js`, encodeBase64(fileContent));
}

const outputMapFile = async (mapId: string, content: FileData) => {

    const fileContent = `main.floors.${mapId}=\n${beautifyFileDataJSON(content)}`;

    await writeFile(`project/floors/${mapId}.js`, encodeBase64(fileContent));
}

const loadTileSet = async (filename: string): Promise<ViewTile[]> => {
    const imageBase64 = await readFile(`project/materials/${filename}.png`);
    const img = await loadImage(`data:image/png;base64,${imageBase64}`);
    if (img.width % TILE_SIZE !== 0 || img.height % TILE_SIZE !== 0) {
        console.warn(`size of ${filename} is not compatible`);
    }

    const tileCount = img.height / TILE_SIZE;

    const tiles = range(tileCount).map((ti) => [ViewTileType.Custom, img, ti] as ViewTile);

    return tiles;
}

const outputTileSet = async (filename: string, tiles: ViewTile[], frame: number) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error(`[output] output tileset ${filename}: 申请ctx失败`);
    canvas.width = TILE_SIZE * frame;
    canvas.height = TILE_SIZE * tiles.length;
    tiles.forEach((tile, ti) => {
        range(frame).forEach((fi) => {
            drawTile(ctx, tile, fi, ti, fi);
        });
    });

    const [imageType, imageBase64] = canvas.toDataURL().split(',');

    await writeFile(`project/materials/${filename}.png`, imageBase64);
}

const GEN_PREFIX = "GEN";

export const outputProject = async (projectData: ProjectData, outputLog: (str: string) => void = noop) => {
    
    const logger = createLogger(outputLog);

    const oldIconData = await loadDataFile(DATA_FILE_MAP.icons);
    const icons: Record<string, Record<string, number>> = {};
    let __genBlockId = 0;
    const createBlockRegister = (cls: string) => {

        const blockMap: Record<string, any> = {};
        const blocks: [string, ViewTile][] = [];
        const slots: number[] = [];
        icons[cls] = {};

        const registerBlock = (tile: ViewTile, block: any) => {
            const blockId = `${GEN_PREFIX}${__genBlockId}`;
            __genBlockId++;
            blocks.push([blockId, tile]);
            blockMap[blockId] = block;
            return blockId;
        };
        
        const oldTileSetTask = loadTileSet(cls);

        const registerReserveBlock = (id: string, block: any) => {
            if (id.startsWith(GEN_PREFIX)) {
                if (id in oldIconData[cls]) {
                    const icon = oldIconData[cls][id];
                    slots.push(icon);
                }
            } else {
                blockMap[id] = block;
                if (id in oldIconData[cls]) {
                    const icon = oldIconData[cls][id];
                    icons[cls][id] = icon;
                }
            }
        }

        const createTileSet = async (frame: number) => {
            logger(`create tileSet ${cls}`);
            const oldTiles = await oldTileSetTask;
            const tiles: ViewTile[] = [...oldTiles];
            const leftSlots = [...slots].reverse();
            blocks.forEach(([blockId, tile]) => {
                const slot = leftSlots.pop();
                if (slot !== void 0) {
                    icons[cls][blockId] = slot;
                    tiles[slot] = tile;
                } else {
                    icons[cls][blockId] = tiles.length;
                    tiles.push(tile);
                }
            });
            await outputTileSet(cls, tiles, frame);
            return blockMap;
        };

        return {
            registerBlock,
            registerReserveBlock,
            createTileSet,
        }
    };

    /**
     * 生成怪物
     */
    logger.group("start output enemyData");
    const enemyMap: Record<number, string> = {};
    {
        const { enemies } = projectData;
        const { registerBlock, registerReserveBlock, createTileSet } = createBlockRegister("enemys");
        enemies.map((enemy, ei) => {
            const { tile, name, ...props } = enemy;
            logger(`generate enemy [${name}]`);
            const blockId = registerBlock(tile, {
                name,
                ...props,
                money: 0,
                exp: 0,
                point: 0,
            });
            enemyMap[ei] = blockId;
        });
    
        logger("read old enemy.js");
        const oldEnemyData = await loadDataFile(DATA_FILE_MAP.enemies);
        Object.entries(oldEnemyData).forEach(([id, enemy]) => {
            // logger(`keep reserve enemy [${v.name}]`);
            registerReserveBlock(id, enemy);
        });
    
        logger("write file enemys.js");
        const enemyData = await createTileSet(2);
        await outputDataFile(DATA_FILE_MAP.enemies, enemyData);
    }
    logger.groupEnd("output enemyData success");

    /**
     * 生成物品
     */
    logger.group("start output itemData");
    const potionMap: Record<number, string> = {};
    const gemMap: Record<number, string> = {};
    {
        const { potions, gems } = projectData;
        const { registerBlock, registerReserveBlock, createTileSet } = createBlockRegister("items");

        type Effect = [string, string, number];
        const genEffectProps = (effects: Effect[]) => {
            const useItemEffect: string[] = [];
            const text: string[] = [];
            const itemEffect: string[] = [];
            const itemEffectTip: string[] = [];
            
            effects.forEach(([label, key, value]) => {
                useItemEffect.push(`${label}+${value}`);
                text.push(`${label}+${value}`);
                itemEffect.push(`core.status.hero.${key} += ${value} * core.status.thisMap.ratio`);
                itemEffectTip.push(`${label}+\${core.status.hero.${key} += ${value} * core.status.thisMap.ratio}`);
            });

            return {
                useItemEffect: useItemEffect.join(';'),
                text: text.join('，'),
                itemEffect: itemEffect.join(';'),
                itemEffectTip: '，' + text.join('，'),
            }
        }

        potions.forEach((potion, pi) => {
            const { tile, name, hp } = potion;
            logger(`generate potion [${name}]`);
            const blockId = registerBlock(tile, {
                cls: "items",
                name: name,
                ...genEffectProps([["血量", "hp", hp]]),
            });
            
            potionMap[pi] = blockId;
        });
        gems.forEach((gem, gi) => {
            const { tile, name, ...props } = gem;
            logger(`generate gem [${name}]`);

            const effects: Effect[] = [];
            if (props.atk > 0) effects.push(["攻击", "atk", props.atk]);
            if (props.def > 0) effects.push(["防御", "def", props.def]);
            if (props.mdef > 0) effects.push(["护盾", "mdef", props.mdef]);

            const blockId = registerBlock(tile, {
                cls: "items",
                name: name,
                ...genEffectProps(effects),
            });
            
            gemMap[gi] = blockId;
        });
    
        logger("read old items.js");
        const oldItemData = await loadDataFile(DATA_FILE_MAP.items);
        Object.entries(oldItemData).forEach(([id, block]) => {
            // logger(`keep reserve item [${v.name}]`);
            registerReserveBlock(id, block);
        });

        logger("write file items.js");
        const itemData = await createTileSet(1);
        await outputDataFile(DATA_FILE_MAP.items, itemData);
    }
    logger.groupEnd("output itemData success");

    /**
     * 生成icons
     */
    logger.group("start output iconData");
    {
        const iconData = {
            ...oldIconData,
            ...icons,
        };

        logger("write file icons.js");
        await outputDataFile(DATA_FILE_MAP.icons, iconData);
    }
    logger.groupEnd("output iconData success");

    /**
     * 生成maps.js
     */
    logger.group("start output blockData");
    const blockIdMap: Record<string, number> = {};
    {
        const { enemies, potions, gems } = projectData;

        const oldBlockData = await loadDataFile(DATA_FILE_MAP.maps);

        type MapBlock = { id: string, cls: string };
        const blockData: Record<number, MapBlock> = {};
        let maxNumber = 0;
        Object.entries(oldBlockData).forEach(([blockKey, block]) => {
            if (block.id.startsWith(GEN_PREFIX)) return;
            const blockNumber = Number(blockKey);
            maxNumber = Math.max(maxNumber, blockNumber);
            blockData[blockNumber] = block;
        });

        let __blockNumber = maxNumber + 1;
        const registerMapBlock = (block: MapBlock) => {
            const blockNumber = __blockNumber++;
            blockData[blockNumber] = block;
        }
        enemies.forEach((_, ei) => {
            const blockId = enemyMap[ei];
            registerMapBlock({
                cls: "enemys",
                id: blockId
            });
        });
        potions.forEach((_, pi) => {
            const blockId = potionMap[pi];
            registerMapBlock({
                cls: "items",
                id: blockId
            });
        });
        gems.forEach((_, gi) => {
            const blockId = gemMap[gi];
            registerMapBlock({
                cls: "items",
                id: blockId
            });
        });

        Object.entries(blockData).forEach(([blockKey, block]) => {
            const blockNumber = Number(blockKey);
            blockIdMap[block.id] = blockNumber;
        });

        logger("write file maps.js");
        await outputDataFile(DATA_FILE_MAP.maps, blockData);
    }
    logger.groupEnd("output blockData success");

    /**
     * 生成floors/*.js
     */
    const mapIds: string[] = [];
    logger.group("start output maps");
    {
        const STAIR_DICT = {
            [StairDir.Down]: "downFloor",
            [StairDir.Up]: "upFloor"
        } satisfies Record<StairDir, string>;
        const WALL_DICT = {
            [WallType.Normal]: "yellowWall",
            [WallType.Unbreak]: "blueWall",
        } satisfies Record<WallType, string>;
        const KEY_DICT = {
            [DoorKeyType.Yellow]: "yellowKey",
            [DoorKeyType.Blue]: "blueKey",
            [DoorKeyType.Green]: "greenKey",
            [DoorKeyType.Red]: "redKey",
        } satisfies Record<DoorKeyType, string>;
        const DOOR_DICT = {
            [DoorKeyType.Yellow]: "yellowDoor",
            [DoorKeyType.Blue]: "blueDoor",
            [DoorKeyType.Green]: "greenDoor",
            [DoorKeyType.Red]: "redDoor",
        } satisfies Record<DoorKeyType, string>;
        const getBlockId = (block: Block): string | undefined => {
            switch (block.type) {
                case BlockType.Empty: return void 0;
                case BlockType.Stair: return STAIR_DICT[block.dir];
                case BlockType.Wall: return WALL_DICT[block.wallType];
                case BlockType.Event: {
                    const { event } = block;
                    switch (event.type) {
                        case EventType.Door: return DOOR_DICT[event.doorType];
                        case EventType.Key: return KEY_DICT[event.keyType];
                        case EventType.Enemy: return enemyMap[event.index];
                        case EventType.Potion: return potionMap[event.index];
                        case EventType.Gem: return gemMap[event.index];
                        default: return void 0;
                    }
                }
            }
        }
        const { maps, mapTitle } = projectData;
        const mapTasks = maps.map(async (map, mi) => {
            const mapId = `${GEN_PREFIX}${mi}`;
            mapIds.push(mapId);

            const title = mapTitle(mi);
            const changeFloor: Record<string, any> = {};
            const mapLayer = MapLayer.traversal(map, (block, loc) => {
                const blockId = getBlockId(block);
                if (block.type === BlockType.Stair) {
                    if (block.dir === StairDir.Up) {
                        changeFloor[Loc.dump(loc)] = {
                            "floorId": ":next",
                            "stair": "downFloor"
                        };
                    } else {
                        changeFloor[Loc.dump(loc)] = {
                            "floorId": ":before",
                            "stair": "upFloor"
                        };
                    }
                }
                return blockId ? blockIdMap[blockId] : 0;
            });

            const mapData = {
                "floorId": mapId,
                "title": title,
                "name": title,
                "canFlyTo": true,
                "canFlyFrom": true,
                "canUseQuickShop": true,
                "cannotViewMap": false,
                "defaultGround": "ground",
                "images": [],
                "ratio": 1,
                "map": mapLayer,
                "firstArrive": [],
                "parallelDo": "",
                "events": {},
                "changeFloor": changeFloor,
                "afterBattle": {},
                "afterGetItem": {},
                "afterOpenDoor": {},
                "cannotMove": {},
                "bgmap": [],
                "fgmap": [],
                "width": MAP_SIZE,
                "height": MAP_SIZE,
                "autoEvent": {}
            };

            logger(`generate map ${mapId}`);
            await outputMapFile(mapId, mapData);
        });
        Promise.all(mapTasks);
    }
    logger.groupEnd("output maps success");

    /**
     * 生成data.js
     * 修改 地图
     */
    logger.group("start output mainData");
    {
        const oldData = await loadDataFile(DATA_FILE_MAP.data);
        const oldFloorIds: string[] = oldData.main.floorIds;

        const insertFloodIds = [...mapIds];
        const floorIds: string[] = [];
        oldFloorIds.forEach((e) => {
            if (e.startsWith(GEN_PREFIX) && !insertFloodIds.includes(e)) return;
            floorIds.push(e);
        });
        insertFloodIds.forEach((e) => {
            if (!floorIds.includes(e)) {
                floorIds.push(e);
            }
        });
        oldData.main.floorIds = floorIds;

        outputDataFile(DATA_FILE_MAP.data, oldData);
    }
    logger.groupEnd("output mainData success");

    logger("output project success");
}
