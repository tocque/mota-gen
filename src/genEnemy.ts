import { Enemy, EnemyTemplate, EnemyTemplatePreset, Hero } from "./type";
import { normalRandom, randomPickElement } from "./utils";

const presets: EnemyTemplatePreset[] = [
    { name: "史莱姆", special: [], hp: 50, atk: 20, def: 4 },
    { name: "蝙蝠", special: [], hp: 55, atk: 32, def: 2 },
    { name: "大蝙蝠", special: [4], hp: 65, atk: 55, def: 12 },
    { name: "法师", special: [2], hp: 65, atk: 10, def: 5 },
    { name: "骷髅士兵", special: [], hp: 190, atk: 100, def: 5 },
    { name: "丧尸", special: [], hp: 190, atk: 90, def: 33 },
    { name: "双手剑士", special: [], hp: 100, atk: 680, def: 50 },
    { name: "石头人", special: [3], hp: 30, atk: 45, def: 70 },
];

export function genEnemyTemplate(): EnemyTemplate {
    const template = randomPickElement(presets);

    const genValue = (value: number): number => {
        return Math.max(normalRandom(value, value / 5), 0);
    }

    return {
        preset: template,
        special: [ ...template.special ],
        hp: genValue(template.hp),
        atk: genValue(template.atk),
        def: genValue(template.def),
    }
}

export function calDamage(hero: Hero, enemy: Enemy) {

    const hero_atk = hero.atk;
    const hero_def = hero.def;
    const hero_mdef = hero.mdef;

    const enemy_hp = enemy.hp;
    const enemy_atk = enemy.atk;
    const enemy_def = Math.max(enemy.def, hero.atk-1);

    function hasSpecial(target: number) {
        return enemy.special.includes(target);
    }

	// 战前造成的额外伤害（可被护盾抵消）
	let init_damage = 0;

	// 每回合怪物对勇士造成的战斗伤害
	let per_damage = enemy_atk - hero_def;
	// 魔攻：战斗伤害就是怪物攻击力
	if (hasSpecial(2)) per_damage = enemy_atk;
	// 战斗伤害不能为负值
	if (per_damage < 0) per_damage = 0;

	// 2连击 & 3连击 & N连击
	if (hasSpecial(4)) per_damage *= 2;

	// 先攻
	if (hasSpecial(1)) init_damage += per_damage;

	// 勇士每回合对怪物造成的伤害
	const hero_per_damage = Math.max(hero_atk - enemy_def, 0);

	// 如果没有破防，则不可战斗
	if (hero_per_damage <= 0) return null;

	// 勇士的攻击回合数；为怪物生命除以每回合伤害向上取整
	const turn = Math.ceil(enemy_hp / hero_per_damage);

	// 最终伤害：初始伤害 + 怪物对勇士造成的伤害 + 反击伤害
	const damage = init_damage + (turn - 1) * per_damage - hero_mdef;


	return damage;
}

function createEnemy(template: EnemyTemplate, growth: number): Enemy {

    const createValue = (value: number) => {
        return Math.ceil(value * growth);
    };

    return {
        hp: createValue(template.hp),
        special: [ ...template.special ],
        atk: createValue(template.atk),
        def: createValue(template.def),
    }
}

export function genEnemy(hero: Hero, template: EnemyTemplate, damage: number): Enemy {
    const BASE = 1e-3;
    let l = BASE, r = BASE * 1e10;
    while (r - l > BASE * 2) {
        const mid = (l + r) / 2;
        const midDamage = calDamage(hero, createEnemy(template, l));
        if (midDamage === null || midDamage < damage) l = mid + BASE;
        else r = mid;
    }
    return createEnemy(template, l);
}
