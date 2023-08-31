import { Enemy, Hero, Values } from "./genEnemy";
import { DoorKeyType, Gem, Potion } from "./genItem";
import { MapContext } from "./genMap";
import { ILoc } from "./loc";

export interface ProjectData {
    mapCount: number;
    mapTitle: (mi: number) => string;
    maps: MapContext['blockMap'][];
    enemies: Enemy[];
    potions: Potion[];
    gems: Gem[];
    initLoc: ILoc;
    initStatus: {
        hp: 1000;
        hero: Hero;
    };
    values: Values & {
        keys: Record<DoorKeyType, number>;
        ability: {
            atk: number;
            def: number;
            mdef: number;
        };
    };
}
