import { ViewEnemyTile, ViewTile, ViewTileType } from "@/view/tile";
import { normalRandom, randomPickElement } from "./utils";
import { range } from "lodash-es";

export interface EnemyTemplatePreset {
    name: string;
    special: number[];
    hp: number;
    atk: number;
    def: number;
}

export enum EnemySpecial {
    AttackFirst = 1,
    MagicAttack = 2,
    Solid = 3,
    DoubleHit = 4,
}

export const ENEMY_SPECIAL_MAP = {
    [EnemySpecial.AttackFirst]: '先攻',
    [EnemySpecial.MagicAttack]: '魔攻',
    [EnemySpecial.Solid]: '坚固',
    [EnemySpecial.DoubleHit]: '二连击',
} satisfies Record<EnemySpecial, string>;

export interface EnemyTemplate {
    tile: ViewTile;
    name: string;
    /** 先攻(1) 魔攻(2) 坚固(3) 二连击(4) */
    special: EnemySpecial[];
    /** 生命值成长率 */
    hp: number;
    /** 攻击力成长率 */
    atk: number;
    /** 防御力成长率 */
    def: number;
}

export interface Hero {
    atk: number;
    def: number;
    mdef: number;
}

export interface Enemy {
    tile: ViewTile;
    name: string;
    special: EnemySpecial[];
    hp: number;
    atk: number;
    def: number;
}

export const enemyPresets = {
    slime: { name: "史莱姆", hp: 50, atk: 20, def: 4, special: [] },
    bat: { name: "蝙蝠", hp: 55, atk: 32, def: 2, special: [] },
    bigbat: { name: "大蝙蝠", hp: 65, atk: 55, def: 12, special: [EnemySpecial.DoubleHit] },
    priest: { name: "法师", hp: 65, atk: 10, def: 5, special: [EnemySpecial.MagicAttack] },
    skeleton: { name: "骷髅士兵", hp: 190, atk: 100, def: 5, special: [] },
    undead: { name: "丧尸", hp: 190, atk: 90, def: 33, special: [] },
    swordman: { name: "双手剑士", hp: 100, atk: 680, def: 50, special: [] },
    rock: { name: "石头人", hp: 30, atk: 45, def: 70, special: [EnemySpecial.Solid] },
    guard: { name: "卫兵", hp: 30, atk: 45, def: 20, special: [EnemySpecial.Solid] },
} satisfies Record<string, EnemyTemplatePreset>;

export function genEnemyTemplate(name: string, tile: ViewEnemyTile, preset: EnemyTemplatePreset): EnemyTemplate {

    const genValue = (value: number): number => {
        return Math.max(normalRandom(value, value / 5), 0);
    }

    return {
        name,
        tile: [ViewTileType.Enemy, tile],
        special: [ ...preset.special ],
        hp: genValue(preset.hp),
        atk: genValue(preset.atk),
        def: genValue(preset.def),
    }
}

export function calDamage(hero: Hero, enemy: Enemy) {

    const hero_atk = hero.atk;
    const hero_def = hero.def;
    const hero_mdef = hero.mdef;

    const enemy_hp = enemy.hp;
    const enemy_atk = enemy.atk;
    const enemy_def = hasSpecial(EnemySpecial.Solid) ? Math.max(enemy.def, hero.atk-1) : enemy.def;

    function hasSpecial(target: number) {
        return enemy.special.includes(target);
    }

	// 战前造成的额外伤害（可被护盾抵消）
	let init_damage = 0;

	// 每回合怪物对勇士造成的战斗伤害
	let per_damage = enemy_atk - hero_def;
	// 魔攻：战斗伤害就是怪物攻击力
	if (hasSpecial(EnemySpecial.MagicAttack)) per_damage = enemy_atk;
	// 战斗伤害不能为负值
	if (per_damage < 0) per_damage = 0;

	// 2连击 & 3连击 & N连击
	if (hasSpecial(EnemySpecial.DoubleHit)) per_damage *= 2;

	// 先攻
	if (hasSpecial(EnemySpecial.AttackFirst)) init_damage += per_damage;

	// 勇士每回合对怪物造成的伤害
	const hero_per_damage = Math.max(hero_atk - enemy_def, 0);

	// 如果没有破防，则不可战斗
	if (hero_per_damage <= 0) return null;

	// 勇士的攻击回合数；为怪物生命除以每回合伤害向上取整
	const turn = Math.ceil(enemy_hp / hero_per_damage);

	// 最终伤害：初始伤害 + 怪物对勇士造成的伤害 + 反击伤害
	const damage = init_damage + (turn - 1) * per_damage - hero_mdef;


	return Math.max(damage, 0);
}

function createEnemy(template: EnemyTemplate, growth: number): Enemy {

    const createValue = (value: number) => {
        return Math.floor(value * growth);
    };

    return {
        tile: template.tile,
        name: template.name,
        hp: createValue(template.hp),
        special: [ ...template.special ],
        atk: createValue(template.atk),
        def: createValue(template.def),
    };
}

export function genEnemy(hero: Hero, template: EnemyTemplate, damage: number): Enemy {
    const BASE = 1e-3;
    let l = BASE, r = BASE * 1e10;
    while (r - l > BASE * 2) {
        const mid = (l + r) / 2;
        const midDamage = calDamage(hero, createEnemy(template, mid));
        if (midDamage !== null && midDamage < damage) l = mid + BASE;
        else r = mid;
    }
    return createEnemy(template, l);
}

export interface Values {
    base: number;
    cpiFormula: (hero: Hero) => number;
    inflation: {
        atk: number;
        def: number;
        mdef: number;
        step: number;
    }
}

interface GenAllEnemiesOptions {
    initHero: Hero;
    values: Values;
    stage: number[];
}

/**
 * 生成怪物属性
 * @param enemyTemplates 
 * @param options 
 */
export function genAllEnemies(enemyTemplates: EnemyTemplate[], options: GenAllEnemiesOptions): Enemy[] {
    const { initHero, values, stage } = options;
    const { base, cpiFormula, inflation } = values;

    // const steps = range(inflation.step + 3);
    // const pickedSteps = range(enemyTemplates.length).map(() => randomPickElement(steps));
    // const sortedSteps = pickedSteps.sort((a, b) => a- b);
    const sortedSteps: number[] = [];

    stage.forEach((_, si) => {
        const step = 9;
        const pick = 4;
        range(pick).forEach((i) => {
            sortedSteps.push(~~(i * 1.7) + si * step);
        });
    });
    sortedSteps.push(25);

    return enemyTemplates.map((template, i) => {
        // const enemy = createEnemy(template, 1);

        const step = sortedSteps[i];

        const hero: Hero = {
            atk: initHero.atk + step * inflation.atk,
            def: initHero.def + step * inflation.def,
            mdef: initHero.mdef + step * inflation.mdef,
        };

        const damage = base * cpiFormula(hero);
        
        const enemy = genEnemy(hero, template, damage);
        console.log(enemy, hero, damage);

        return enemy;
    });
}
