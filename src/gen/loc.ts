import { inRange, isEqual, random } from "lodash-es";
import { MAP_SIZE } from "./const";

export type ILoc = Readonly<[number, number]>;

export enum Direction {
    Up,
    Down,
    Left,
    Right,
}

export class Loc {

    static dump([ x, y ]: ILoc): string {
        return `${x},${y}`;
    }

    static load(str: string): ILoc {
        const [x, y] = str.split(",");
        return [ Number(x), Number(y) ];
    }

    static up([ x, y ]: ILoc): ILoc {
        return [ x, y-1 ];
    }
    
    static down([ x, y ]: ILoc): ILoc {
        return [ x, y+1 ];
    }
    
    static left([ x, y ]: ILoc): ILoc {
        return [ x-1, y ];
    }
    
    static right([ x, y ]: ILoc): ILoc {
        return [ x+1, y ];
    }
    
    static isValid([ x, y ]: ILoc) {
        return inRange(x, 0, MAP_SIZE) && inRange(y, 0, MAP_SIZE);
    }

    static dir(loc: ILoc, dir: Direction) {
        switch (dir) {
            case Direction.Up: return Loc.up(loc);
            case Direction.Down: return Loc.down(loc);
            case Direction.Left: return Loc.left(loc);
            case Direction.Right: return Loc.right(loc);
        }
    }
    
    static freeDir4(loc: ILoc): ILoc[] {
        return [ Loc.up(loc), Loc.down(loc), Loc.left(loc), Loc.right(loc) ];
    }
    
    static dir4(loc: ILoc): ILoc[] {
        return Loc.freeDir4(loc).filter(Loc.isValid);
    }
    
    static freeDir8(loc: ILoc): ILoc[] {
        return [
            Loc.up(loc), Loc.down(loc), Loc.left(loc), Loc.right(loc),
            Loc.left(Loc.up(loc)), Loc.right(Loc.up(loc)),
            Loc.left(Loc.down(loc)), Loc.right(Loc.down(loc)),
        ];
    }
    
    static dir8(loc: ILoc): ILoc[] {
        return Loc.freeDir8(loc).filter(Loc.isValid);
    }

    static isNear(a: ILoc, b: ILoc) {
        return Loc.freeDir4(a).some((e) => isEqual(e, b));
    }
    
    static random(): ILoc {
        return [ random(MAP_SIZE-1), random(MAP_SIZE-1) ];
    }

    static distance([x1, y1]: ILoc, [x2, y2]: ILoc): number {
        return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
    }
}