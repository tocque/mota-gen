import { MinPriorityQueue } from "@datastructures-js/priority-queue";

interface DijkstraOptions<T, P> {
    extractDist: (p: P) => number,
    skip: (v: T) => boolean
}

export class Graph<T, V extends string | number, P = void> {

    protected readonly edgeMap = new Map<V, [V, P][]>();

    protected readonly dump: (id: T) => V;
    protected readonly load: (id: V) => T;

    constructor({ loader, dumper } : { dumper: (id: T) => V, loader: (id: V) => T }) {
        this.dump = dumper;
        this.load = loader;
    }

    /**
     * 添加单向边
     */
    addEdge(from: T, to: T, payload: P) {
        const fromId = this.dump(from);
        const toId = this.dump(to);
        if (!this.edgeMap.has(fromId)) {
            this.edgeMap.set(fromId, []);
        }
        this.edgeMap.get(fromId)!.push([toId, payload]);
    }
    
    /**
     * 添加单向边
     */
    addEdges(from: T, toPairs: [T, P][]) {
        const fromId = this.dump(from);
        const toIdPairs = toPairs.map(([t, p]) => [this.dump(t), p] as [V, P]);
        const edges = (this.edgeMap.get(fromId) ?? []).concat(toIdPairs);
        this.edgeMap.set(fromId, edges);
    }

    protected _iterate(from: V, visitor: (to: V, payload: P) => void) {
        this.edgeMap.get(from)!.forEach(([t, p]) => visitor(t, p));
    }

    /**
     * 遍历
     * @param from 
     */
    protected iterate(from: T, visitor: (to: T, payload: P) => void) {
        const fromId = this.dump(from);
        this.edgeMap.get(fromId)!.forEach(([t, p]) => visitor(this.load(t), p));
    }

    protected _singleSourceDFS(source: V, skip: (t: V) => boolean = () => false): V[] {
        const visited = new Set<V>();
        const res: V[] = [];
        const visit = (now: V) => {
            if (visited.has(now)) return;
            visited.add(now);
            res.push(now);
            this._iterate(now, (nxt) => {
                if (skip(nxt)) return;
                visit(nxt);
            });
        };
        visit(source);
        return res;
    }

    /**
     * 单源dfs
     * @param source
     * @returns 访问过的所有节点
     */
    singleSourceDFS(source: T): T[] {
        const sourceId = this.dump(source);
        const res = this._singleSourceDFS(sourceId);
        return res.map((e) => this.load(e));
    }

    protected _multiSourceDFS(sources?: V[], skip: (t: V) => boolean = () => false): V[][] {
        const visited = new Set<V>();
        const res: V[][] = [];
        (sources ?? Array.from(this.edgeMap.keys())).forEach((nw) => {
            if (visited.has(nw)) return;
            if (skip(nw)) return;
            const singleRes = this._singleSourceDFS(nw, skip);
            singleRes.forEach((vtx) => {
                visited.add(vtx);
            });
            res.push(singleRes);
        });
        return res;
    }
    
    /**
     * 多源DFS
     * @param sources 源点，不填则为全源
     * @returns 访问过的所有连通块
     */
    multiSourceDFS(sources?: T[]): T[][] {
        const res: V[][] = this._multiSourceDFS(sources ? sources.map(e => this.dump(e)) : void 0);
        return res.map((block) => block.map((e) => this.load(e)));
    }

    // filterVertex(vtx: T): Graph<T, V, P> {
    //     const { dump: dumper, load: loader } = this;
    //     const graph = new Graph<T, V, P>({ dumper, loader });
    //     const vtxId = this.dump(vtx);
    //     this.edgeMap.forEach((toIdPairs, fromId) => {
    //         if (fromId === vtxId) return;
    //         graph.edgeMap.set(fromId, toIdPairs.filter(([v]) => v !== vtxId));
    //     });
    //     return graph;
    // }
    
    /**
     * 扫描割点，即"如果移除当前节点"，原先所在的连通块会被分成几块
     * @param vtx 
     */
    scanCut(vtx: T): T[][] {
        const vtxId = this.dump(vtx);
        const block = this._singleSourceDFS(vtxId);
        const res = this._multiSourceDFS(block.filter(e => e !== vtxId), (v) => v === vtxId);
        return res.map((block) => block.map((e) => this.load(e)));
    }
    
    dijkstra(source: T, options: Partial<DijkstraOptions<T, P>> = {}): [T, number][] {
        const sourceId = this.dump(source);
        const { extractDist = Number, skip = () => false } = options;
        // @ts-ignore
        const distMap: Record<V, number> = {};
        const res: [V, number][] = [];
        const pq = new MinPriorityQueue((a: [V, number]) => a[1]);
        pq.push([sourceId, 0]);

        while (!pq.isEmpty()) {
            const [now, dist] = pq.pop();
            if (now in distMap) continue;
            distMap[now] = dist;
            res.push([now, dist]);
            this._iterate(now, (to, l) => {
                if (skip && skip(this.load(to))) return;
                pq.push([ to, dist + extractDist(l) ]);
            });
        }

        return res.map(([t, l]) => [this.load(t), l] as [T, number]);
    }    
}
