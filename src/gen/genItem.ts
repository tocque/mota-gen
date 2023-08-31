import { ViewItemTile, ViewTerrainTile, ViewTile, ViewTileType } from "@/view/tile";

export enum DoorKeyType {
    Yellow,
    Blue,
    Red,
    Green,
}

export const KEY_TILE_MAP = {
    [DoorKeyType.Yellow]: [ViewTileType.Item, ViewItemTile.yellowKey],
    [DoorKeyType.Blue]: [ViewTileType.Item, ViewItemTile.blueKey],
    [DoorKeyType.Red]: [ViewTileType.Item, ViewItemTile.redKey],
    [DoorKeyType.Green]: [ViewTileType.Item, ViewItemTile.greenKey],
} satisfies Record<DoorKeyType, ViewTile>;

export const DOOR_TILE_MAP = {
    [DoorKeyType.Yellow]: [ViewTileType.Terrain, ViewTerrainTile.yellowDoor],
    [DoorKeyType.Blue]: [ViewTileType.Terrain, ViewTerrainTile.blueDoor],
    [DoorKeyType.Red]: [ViewTileType.Terrain, ViewTerrainTile.redDoor],
    [DoorKeyType.Green]: [ViewTileType.Terrain, ViewTerrainTile.greenDoor],
} satisfies Record<DoorKeyType, ViewTile>;

export interface Potion {
    name: string;
    tile: ViewTile;
    hp: number;
}

export interface Gem {
    name: string;
    tile: ViewTile;
    atk: number;
    def: number;
    mdef: number;
}
