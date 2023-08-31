<script lang="ts" setup>
import { BlockType, EventType, MapContext, StairDir, WallType, statMapContext } from '@/gen/genMap';
import MapView from './MapView.vue';
import { computed, toRaw } from 'vue';
import { projectData } from './store';
import { ProjectData } from '@/gen/type';
import { DOOR_TILE_MAP, KEY_TILE_MAP } from '@/gen/genItem';
import { MapLayer } from '@/gen/mapLayer';
import { ViewTile, ViewTileType, ViewTerrainTile } from './tile';

const props = defineProps<{ contexts: MapContext[], showMark: boolean, showDebug: boolean }>();

/**
 * 
 * @param mapCtx 
 * @param projectData 
 * @returns 
 */
const renderViewMap = (mapCtx: MapContext, projectData: ProjectData) => {
    const { enemies, potions, gems } = projectData;
    return {
        tileMap: MapLayer.traversal(mapCtx.blockMap, (block): ViewTile => {
            switch (block.type) {
                case BlockType.Empty: return [ViewTileType.Empty];
                case BlockType.Stair: {
                    switch (block.dir) {
                        case StairDir.Down: return [ViewTileType.Terrain, ViewTerrainTile.downFloor];
                        case StairDir.Up: return [ViewTileType.Terrain, ViewTerrainTile.upFloor];
                    }
                }
                case BlockType.Wall: {
                    switch (block.wallType) {
                        case WallType.Normal: return [ViewTileType.Terrain, ViewTerrainTile.yellowWall];
                        case WallType.Unbreak: return [ViewTileType.Terrain, ViewTerrainTile.blueWall];
                    }
                }
                case BlockType.Event: {
                    const { event } = block;
                    switch (event.type) {
                        case EventType.Door: return DOOR_TILE_MAP[event.doorType];
                        case EventType.Key: return KEY_TILE_MAP[event.keyType];
                        case EventType.Enemy: return enemies[event.index].tile;
                        case EventType.Potion: return potions[event.index].tile;
                        case EventType.Gem: return gems[event.index].tile;
                        default: return [ViewTileType.Empty];
                    }
                }
            }
        }),
        markMap: MapLayer.traversal(mapCtx.markMap, (mark) => mark),
        debugMap: MapLayer.traversal(mapCtx.debugMap, (info) => info),
        venderMap: MapLayer.traversal(mapCtx.venderMap, (info) => info),
    };
};

const renderingContexts = computed(() => {
    const rawProjectData = toRaw(projectData);
    return props.contexts.map((context) => {
        const { tileMap, markMap, debugMap, venderMap } = renderViewMap(context, rawProjectData);
        const stat = statMapContext(context);
        return {
            stat,
            tileMap,
            markMap: props.showMark ? markMap : void 0,
            debugMap: props.showDebug ? debugMap : void 0,
            venderMap,
        }
    });
});

</script>
<template>
    <div class="views">
        <div class="view" v-for="(context, i) of renderingContexts" :key="i">
            <pre>#{{ i }} {{context.stat}}</pre>
            <MapView
                :tileMap="context.tileMap"
                :markMap="context.markMap"
                :debugMap="context.debugMap"
                :venderMap="context.venderMap"
            />
        </div>
    </div>
</template>
<style lang="less" scoped>
.views {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    .view {
        margin: 4px;
        padding: 6px 12px;
        background-color: #EEEEEE;
        width: fit-content;
    }
}
</style>