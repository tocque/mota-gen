import { isFunction, range } from "lodash-es";
import { ILoc, Loc } from "./loc";
import { MAP_SIZE } from "./const";
import { Graph } from "./algo/graph";
import { Setter, execSetter } from "./utils";

export type IMapLayer<T> = T[][];

export type GraphAccessor<T, K> = (value: T, loc: ILoc, getter: (loc: ILoc) => T) => K;

export class MapLayer {

    static create<T>(initializer: (Location: ILoc) => T): IMapLayer<T> {
        return range(MAP_SIZE).map((y) => (
            range(MAP_SIZE).map((x) => (
                initializer([x, y])
            ))
        ));
    }

    static init<T>(map: IMapLayer<T>, initializer: (Location: ILoc) => T): void {
        MapLayer.traversal(map, (_, loc) => {
            const [x, y] = loc;
            map[y][x] = initializer(loc);
        });
    }

    static set<T>(map: IMapLayer<T>, locs: ILoc | ILoc[], setter: Setter<T>) {
        locs = (locs[0] === void 0 || Array.isArray(locs[0]) ? locs : [locs]) as ILoc[];
        locs.forEach(([x, y]) => {
            map[y][x] = execSetter(setter, map[y][x]);
        });
    }

    static get<T>(map: IMapLayer<T>, [ x, y ]: ILoc): T {
        return map[y][x];
    }
    
    static isConner([ x, y ]: ILoc) {
        return (x === 0 || x === MAP_SIZE - 1) && (y === 0 || y === MAP_SIZE - 1);
    }
    
    static isBorder([ x, y ]: ILoc) {
        return x === 0 || x === MAP_SIZE - 1 || y === 0 || y === MAP_SIZE - 1;
    }

    static createAccessor = <T>(map: IMapLayer<T>) => {

        const getter = (loc: ILoc) => MapLayer.get(map, loc);
        // @ts-ignore
        const setter = (loc: ILoc | ILoc[], setter: Setter<T>) => MapLayer.set(map, loc, setter);
        const batchGetter = (locs: ILoc[]) => locs.map((loc) => MapLayer.get(map, loc));

        return [
            getter,
            setter,
            batchGetter,
        ] as const;
    }
    
    static traversal<T, K>(map: IMapLayer<T>, visitor: (value: T, loc: ILoc) => K): IMapLayer<K> {
        return map.map((row, y) => (
            row.map((value, x) => (
                visitor(value, [ x, y ])
            ))
        ));
    }

    static buildGraph<T, K = void>(map: IMapLayer<T>, accessor: GraphAccessor<T, [ILoc, K][]>): Graph<ILoc, string, K> {
        const graph = new Graph<ILoc, string, K>({
            loader: Loc.load,
            dumper: Loc.dump,
        });
        const [getter] = MapLayer.createAccessor(map);
        MapLayer.traversal(map, (value, loc) => {
            graph.addEdges(loc, accessor(value, loc, getter));
        });
        return graph;
    }

    static buildGraphDir4<T>(map: IMapLayer<T>, isAccess: (f: [T, ILoc], t: [T, ILoc]) => boolean): Graph<ILoc, string, number> {
        const graph = new Graph<ILoc, string, number>({
            loader: Loc.load,
            dumper: Loc.dump,
        });
        const [getter] = MapLayer.createAccessor(map);
        MapLayer.traversal(map, (value, loc) => {
            graph.addEdges(loc, Loc.dir4(loc).filter((e) => isAccess([value, loc], [getter(e), e])).map(e => [e, 1]));
        });
        return graph;
    }

    // /**
    //  * 单源最短路，返回访问过的所有[块, 到源点的距离]，距离升序排列
    //  * @param map 
    //  * @param source 
    //  * @param accessor 
    //  * @returns 
    //  */
    // static dijkstra<T>(map: IMapLayer<T>, source: ILoc, accessor: GraphAccessor<T, [ILoc, number][]>): [ILoc, number][] {
    //     const graph = MapLayer.buildGraph(map, postConvert(accessor, e => e.map(([loc, w]) => [Loc.dump(loc), w] as [string, number])));
    //     const res = dijkstra(graph, Loc.dump(source));
    //     return res.map(([loc, w]) => [Loc.load(loc), w] as [ILoc, number]);
    // }
}
