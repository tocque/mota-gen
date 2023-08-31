import { isEqual, isFunction, random, range } from "lodash-es";

export function normalRandom(mean: number, std: number) {
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

export function randomPickElement<T>(array: T[], remove = false): T {
    const id = random(0, array.length-1);
    const elm = array[id];
    if (remove) array.splice(id, 1);
    return elm;
}

export function randomJudge(ratio: number): boolean {
    return Math.random() < ratio;
}

export function randomPickWeightedElement<T>(array: T[], getWeight: (value: T, i: number) => number, remove = false): T {
    const weightArray: number[] = [];
    let max = 0;
    array.forEach((e, i) => {
        weightArray.push(max); 
        max += getWeight(e, i);
    });
    const randomValue = random(0, max-1);
    const index = weightArray.findLastIndex((e) => e <= randomValue);
    const elm = array[index];
    if (remove) array.splice(index, 1);
    return elm;
}

const MAX_TRY_TIME = 1e5;

export function planUntil<T>(planer: (time: number) => T, vaildator: (plan: T, time: number) => boolean) {
    let times = 1;
    while (true) {
        const plan = planer(times);
        if (vaildator(plan, times)) return plan;
        times++;
        if (times > MAX_TRY_TIME) {
            throw new Error("try too much time");
        }
    }
}

export function inArray<T>(array: T[], elm: T) {
    return array.some((_elm) => isEqual(elm, _elm));
}

export function allPairs<T>(array: T[]): [ T, T ][] {
    const pairs: [ T, T ][] = [];
    array.forEach((ei, i) => {
        array.forEach((ej, j) => {
            if (i >= j) return;
            pairs.push([ ei, ej ]);
        })
    });
    return pairs;
}

export function postConvert<T extends any[], R, K>(fn: (...args: T) => R, converter: (ret: R) => K): (...args: T) => K {
    return (...args: T) => converter(fn(...args));
}

export type Setter<T> = T | ((old: T) => T);

export function execSetter<T>(setter: Setter<T>, old: T): T {
    if (isFunction(setter)) {
        return setter(old);
    } else {
        return setter;
    }
};
