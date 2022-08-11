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
      equip: [ 15, 15 ],
  },
  initStatus: {
      atk: 10,
      def: 10,
  }
});

console.log(result);
