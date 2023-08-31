import { computed, reactive } from "vue";
import { useImage } from "./utils";
import { TILE_SIZE } from "@/gen/const";

export enum ViewTileType {
    Empty,
    Terrain,
    Enemy,
    Item,
    Custom,
}

export enum ViewTerrainTile {
    ground = 0,

    yellowWall = 3,

    blueWall = 5,

    downFloor = 23,
    upFloor = 24,

    yellowDoor = 25,
    blueDoor = 26,
    redDoor = 27,

    greenDoor = 28,

    specialDoor = 29,
    steelDoor = 30,
}

export enum ViewEnemyTile {
    greenSlime = 0,
    redSlime = 1,
    blackSlime = 2,
    slimelord = 3,
    bat = 4,
    bigBat = 5,
    redBat = 6,
    vampire = 7,
    skeleton = 8,
    skeletonSoilder = 9,
    skeletonCaptain = 10,
    ghostSkeleton = 11,
    zombie = 12,
    zombieKnight = 13,
    rock = 14,
    slimeMan = 15,
    bluePriest = 16,
    redPriest = 17,
    brownWizard = 18,
    redWizard = 19,
    yellowGuard = 20,
    blueGuard = 21,
    redGuard = 22,
    swordsman = 23,
    soldier = 24,
    yellowKnight = 25,
    redKnight = 26,
    darkKnight = 27,
    blackKing = 28,
    yellowKing = 29,
    greenKing = 30,
    blueKnight = 31,
    goldSlime = 32,
    poisonSkeleton = 33,
    poisonBat = 34,
    steelRock = 35,
    skeletonPriest = 36,
    skeletonKing = 37,
    skeletonWizard = 38,
    redSkeletonCaption = 39,
    badHero = 40,
    demon = 41,
    demonPriest = 42,
    goldHornSlime = 43,
    redKing = 44,
    whiteKing = 45,
    blackMagician = 46,
    silverSlime = 47,
    swordEmperor = 48,
    whiteHornSlime = 49,
    badPrincess = 50,
    badFairy = 51,
    grayPriest = 52,
    redSwordsman = 53,
    whiteGhost = 54,
    poisonZombie = 55,
    magicDragon = 56,
    octopus = 57,
    darkFairy = 58,
    greenKnight = 59
}

export enum ViewItemTile {
    yellowKey = 0,
    blueKey = 1,
    redKey = 2,
    greenKey = 3,
    steelKey = 4,
    bigKey = 6,
    redGem = 16,
    blueGem = 17,
    greenGem = 18,
    yellowJewel = 19,
    redPotion = 20,
    bluePotion = 21,
    greenPotion = 22,
    yellowPotion = 23,
    lifeWand = 33,
    sword0 = 60,
    sword1 = 50,
    sword2 = 51,
    sword3 = 52,
    sword4 = 53,
    sword5 = 54,
    shield0 = 61,
    shield1 = 55,
    shield2 = 56,
    shield3 = 57,
    shield4 = 58,
    shield5 = 59,
    book = 9,
    fly = 12,
    pickaxe = 45,
    icePickaxe = 44,
    bomb = 43,
    centerFly = 13,
    upFly = 15,
    downFly = 14,
    coin = 11,
    snow = 41,
    cross = 40,
    superPotion = 29,
    earthquake = 8,
    poisonWine = 24,
    weakWine = 25,
    curseWine = 27,
    superWine = 28,
    knife = 42,
    moneyPocket = 46,
    shoes = 47,
    hammer = 48,
    jumpShoes = 49,
    skill1 = 30,
    wand = 10
}

export type ViewTile =
    | [ViewTileType.Empty]
    | [ViewTileType.Terrain, ViewTerrainTile]
    | [ViewTileType.Enemy, ViewEnemyTile]
    | [ViewTileType.Item, ViewItemTile]
    | [ViewTileType.Custom, CanvasImageSource, number]

export type ViewMap = ViewTile[][];

const tileImages = reactive({
    [ViewTileType.Terrain]: useImage("terrains.png"),
    [ViewTileType.Enemy]: useImage("enemys.png"),
    [ViewTileType.Item]: useImage("items.png"),
});

export const tileImagesLoaded = computed(() => {
    return Object.values(tileImages).every((e) => e);
});

export const drawTile = (ctx: CanvasRenderingContext2D, tile: ViewTile, x: number, y: number, frame = 0) => {
    const [tileType] = tile;
    if (tileType === ViewTileType.Empty) return;
    const [tileImage, index] = (() => {
        if (tileType === ViewTileType.Custom) {
            return [tile[1], tile[2]];
        } else {
            return [tileImages[tileType], tile[1]];
        }
    })();
    if (!tileImage) return;
    ctx.drawImage(tileImage, TILE_SIZE * frame, TILE_SIZE * index, TILE_SIZE, TILE_SIZE, TILE_SIZE * x, TILE_SIZE * y, TILE_SIZE, TILE_SIZE);
};
