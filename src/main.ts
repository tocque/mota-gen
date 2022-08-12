import './style.css'
import { gen } from './gen';

const result = gen({
    mapCount: 10,
    startLoc: [ 6, 12 ],
    enemies: [],
    params: {
        roomRatio: 75,
    },
    items: {
        jewel: [ 1, 2, 3, 4 ],
        potion: [ 1, 2, 4, 10 ],
        equip: [ 15, 15 ],
    },
    growth: 1.2,
    itemValue: {
        y_key: 10,
        b_key: 30,
        r_key: 100,
        g_key: 300,
        hp_100: 10,
        atk_1: 20,
        def_1: 20, 
        mdef_1: 2,
    },
    initStatus: {
        atk: 10,
        def: 10,
    }
});

console.log(result);
