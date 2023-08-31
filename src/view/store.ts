import { ProjectData } from "@/gen/type";
import { reactive } from "vue";
import { ViewItemTile, ViewTileType } from "./tile";
import { DoorKeyType } from "@/gen/genItem";
import { Hero } from "@/gen/genEnemy";

export const projectData: ProjectData = reactive({
    mapCount: 10,
    mapTitle: (mi) => `主塔 ${mi+1} 层`,
    maps: [],
    enemies: [],
    potions: [
        { name: "红血瓶", tile: [ViewTileType.Item, ViewItemTile.redPotion], hp: 100 },
        { name: "蓝血瓶", tile: [ViewTileType.Item, ViewItemTile.bluePotion], hp: 300 },
        { name: "黄血瓶", tile: [ViewTileType.Item, ViewItemTile.yellowPotion], hp: 600 },
    ],
    gems: [
        { name: "红宝石", tile: [ViewTileType.Item, ViewItemTile.redGem], atk: 1, def: 0, mdef: 0 },
        { name: "蓝宝石", tile: [ViewTileType.Item, ViewItemTile.blueGem], atk: 0, def: 1, mdef: 0 },
        { name: "绿宝石", tile: [ViewTileType.Item, ViewItemTile.greenGem], atk: 0, def: 0, mdef: 3 },
    ],
    values: {
        base: 20,
        keys: {
            [DoorKeyType.Yellow]: 30,
            [DoorKeyType.Blue]: 75,
            [DoorKeyType.Red]: -1,
            [DoorKeyType.Green]: -1,
        },
        ability: {
            atk: 50,
            def: 50,
            mdef: 20,
        },
        cpiFormula: (hero: Hero) => Math.sqrt(hero.atk + hero.def),
        inflation: {
            atk: 1,
            def: 1,
            mdef: 3,
            step: 30,
        }
    },
    initLoc: [6, 12],
    initStatus: {
        hp: 1000,
        hero: {
            atk: 10,
            def: 10,
            mdef: 0,
        },
        keys: {
            [DoorKeyType.Yellow]: 1,
            [DoorKeyType.Blue]: 0,
            [DoorKeyType.Red]: 0,
            [DoorKeyType.Green]: 0,
        },
    },
});
