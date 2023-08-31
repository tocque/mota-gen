import { partition, range } from "lodash-es";

/**
 * 偏序集排序
 * 基于拓扑排序将偏序集分层
 * @param items 
 * @param compare 比较器，返回正数代表 a > b
 * @returns 从大到小输出每一层
 */
export function paritalOrderSort<T>(items: T[], compare: (a: T, b: T) => boolean): T[][] {
    const res: T[][] = [];
    const itemCount = items.length;
    const orderMap = range(itemCount).map(() => new Set<number>());
    const degreeMap = Array(itemCount).fill(0);
    items.forEach((item, i) => {
        items.forEach((_item, j) => {
            const greater = compare(item, _item);
            if (greater) {
                orderMap[i].add(j);
                degreeMap[j]++;
            }
        });
    });
    let leftItemIds = range(itemCount);
    while (leftItemIds.length > 0) {
        const [itemIds, restItemIds] = partition(leftItemIds, (i) => degreeMap[i] === 0);
        itemIds.forEach((itemId) => {
            orderMap[itemId].forEach((to) => degreeMap[to]--);
        });
        res.push(itemIds.map((i) => items[i]));
        leftItemIds = restItemIds;
    }
    return res;
}

export function createDSU(MAP_SIZE: number) {
    const pa = range(MAP_SIZE);

    const findpa = (x: number): number => (x === pa[x] ? x : pa[x] = findpa(pa[x]));

    const isJoint = (x: number, y: number) => findpa(x) === findpa(y);

    const joint = (x: number, y: number) => pa[findpa(x)] = findpa(y);

    return {
        isJoint,
        joint,
    }
}
