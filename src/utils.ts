import { random } from "lodash-es";

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
