import { sum } from "lodash-es";

export class Stat {

    static sum(arr: number[]) {
        return sum(arr);
    }

    static average(arr: number[]) {
        return Stat.sum(arr) / arr.length;
    }

    /**
     * 方差
     */
    static variance(arr: number[]) {
        const avg = Stat.average(arr);
        return Stat.average(arr.map((e) => (e - avg) ** 2));
    }
}