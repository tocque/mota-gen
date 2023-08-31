<script lang="ts" setup>
import { computed, onMounted, ref, shallowRef, watch } from 'vue';
import { TILE_SIZE } from '@/gen/const';
import { IMapLayer, MapLayer } from '@/gen/mapLayer';
import { ViewTile, ViewTileType, ViewTerrainTile, tileImagesLoaded, drawTile } from './tile';
import { ILoc, Loc } from '@/gen/loc';

const props = defineProps<{
    tileMap: IMapLayer<ViewTile>,
    markMap?: IMapLayer<string | undefined>,
    debugMap?: IMapLayer<[string, string][]>,
    venderMap: IMapLayer<string[]>,
}>();

const canvasRef = shallowRef<HTMLCanvasElement>();
const canvasContext = shallowRef<CanvasRenderingContext2D | null>(null);

const tooltipVisible = ref<boolean>(false);
const tooltipContent = ref<string>("");
const tooltipLoc = ref<ILoc>([0, 0]);

const size = computed(() => {
    const w = props.tileMap[0].length;
    const h = props.tileMap.length;
    return {
        width: w * TILE_SIZE,
        height: h * TILE_SIZE,
    };
});
const sizeStyle = computed(() => {
    const { width, height } = size.value;
    return {
        width: width + 'px',
        height: height + 'px',
    };
});

onMounted(() => {
    if (canvasRef.value) {
        const canvas = canvasRef.value;
        canvasContext.value = canvas.getContext("2d");

        const gridify = (x: number) => Math.floor(x / TILE_SIZE);

        canvas.onmousemove = (e) => {
            tooltipVisible.value = true;
            const loc: ILoc = [gridify(e.offsetX), gridify(e.offsetY)];
            const locId = Loc.dump(loc);
            const vender = MapLayer.get(props.venderMap, loc);
            tooltipContent.value = `${locId}:\n${vender.join('\n')}`;
            tooltipLoc.value = [e.offsetX, e.offsetY];
        };
        canvas.onmouseleave = () => {
            tooltipVisible.value = false;
        };
    }
});

watch(() => [
    props.tileMap,
    props.markMap,
    props.debugMap,
    canvasContext.value,
    tileImagesLoaded.value,
], () => {
    const { tileMap, markMap, debugMap } = props;
    if (!(canvasContext.value)) return;
    const ctx = canvasContext.value;
    MapLayer.traversal(tileMap, (_, [x, y]) => {
        drawTile(ctx, [ViewTileType.Terrain, ViewTerrainTile.ground], x, y);
    });
    if (markMap) {
        MapLayer.traversal(markMap, (color, [x, y]) => {
            if (!color) return;
            ctx.fillStyle = color;
            ctx.fillRect(TILE_SIZE * x, TILE_SIZE * y, TILE_SIZE, TILE_SIZE);
        });
    }
    MapLayer.traversal(tileMap, (tile, [x, y]) => {
        drawTile(ctx, tile, x, y);
    });
    ctx.font = "16px normal";
    ctx.textBaseline = "top";
    const printText = (text: string, x: number, y: number, color: string) => {
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
    };
    const printBoldText = (text: string, x: number, y: number, color: string) => {
        printText(text, x+1, y, "#FFFFFF");
        printText(text, x, y+1, "#FFFFFF");
        printText(text, x-1, y, "#FFFFFF");
        printText(text, x, y-1, "#FFFFFF");
        printText(text, x, y, color);
    };
    if (debugMap) {
        MapLayer.traversal(debugMap, (info, [x, y]) => {
            info.forEach(([text, color], i) => {
                printBoldText(text, TILE_SIZE * x, TILE_SIZE * (y) + i * 16, color);
            })
        });
    }
});

</script>
<template>
    <div class="mapview" :style="sizeStyle">
        <canvas
            ref="canvasRef"
            :style="sizeStyle"
            :width="size.width"
            :height="size.height"
        ></canvas>
        <pre
            class="message-tip"
            v-show="tooltipVisible"
            :style="{
                left: tooltipLoc[0] + 'px',
                top: tooltipLoc[1] + 'px',
            }"
        >{{ tooltipContent }}</pre>
    </div>
</template>
<style lang="less" scoped>
.mapview {
    position: relative;
}
.message-tip {
    position: absolute;
    text-align: left;
    font-size: 14px;
    font-family: "Consolas", "menlo", monospace;
    background-color: #EEEEEEB0;
    padding: 8px;
    white-space: pre-wrap;
    border-radius: 4px;
    z-index: 1;
}
</style>