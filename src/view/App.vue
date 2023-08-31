<script lang="ts" setup>
import { computed, h, shallowRef, toRaw } from 'vue';
import { Button, StepProps, Steps } from 'ant-design-vue';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons-vue';
import EnemyTable from './EnemyTable.vue';
import MapViews from './MapViews.vue';
import OutputPanel from './OutputPanel.vue';
import { cloneDeep } from 'lodash-es';
import { genMapBase, genMapPlot, MapContext, genMapRoom } from '@/gen/genMap';
import { DoorKeyType } from '@/gen/genItem';
import { enemyPresets, genAllEnemies, genEnemyTemplate } from '@/gen/genEnemy';
import { ViewEnemyTile } from './tile';
import { Switch } from 'ant-design-vue';
import { useLocalStorage } from '@vueuse/core';
import { projectData } from './store';
import { downloadTextFile } from './utils';

const STEPS: StepProps[] = [
    { title: "怪物生成" },
    { title: "地图生成" },
    { title: "房间生成" },
    { title: "地图布局" },
    { title: "输出工程" },
];

const CONFIG_CURRENT_STEP = "config:current.step";
const CONFIG_SHOW_MARK = "config:show.mark";
const CONFIG_SHOW_DEBUG = "config:show.debug";

const currentStep = useLocalStorage(CONFIG_CURRENT_STEP, STEPS.length-1);
const showMark = useLocalStorage(CONFIG_SHOW_MARK, false);
const showDebug = useLocalStorage(CONFIG_SHOW_DEBUG, false);

const mapBaseContexts = shallowRef<MapContext[]>([]);
const mapRoomContexts = shallowRef<MapContext[]>([]);
const mapPlotContexts = shallowRef<MapContext[]>([]);

const initStatus = {
    hp: 1000,
    hero: {
        atk: 10,
        def: 10,
        mdef: 0,
    },
    keys: {
        [DoorKeyType.Yellow]: 1,
        [DoorKeyType.Blue]: 0,
        [DoorKeyType.Red]: 0,
        [DoorKeyType.Green]: 0,
    }
};

const doGenEnemiesStep = () => {
    const { initStatus, values } = cloneDeep(toRaw(projectData));
    const enemies = genAllEnemies([
        genEnemyTemplate("小史莱姆", ViewEnemyTile.greenSlime, enemyPresets.slime),
        genEnemyTemplate("红史莱姆", ViewEnemyTile.redSlime, enemyPresets.slime),
        genEnemyTemplate("银史莱姆", ViewEnemyTile.silverSlime, enemyPresets.slime),
        genEnemyTemplate("金史莱姆", ViewEnemyTile.goldSlime, enemyPresets.slime),
        genEnemyTemplate("小蝙蝠", ViewEnemyTile.bat, enemyPresets.bat),
        genEnemyTemplate("恶魔史莱姆", ViewEnemyTile.goldHornSlime, enemyPresets.slime),
        genEnemyTemplate("初级法师", ViewEnemyTile.bluePriest, enemyPresets.priest),
        genEnemyTemplate("大史莱姆", ViewEnemyTile.blackSlime, enemyPresets.slime),
        genEnemyTemplate("大蝙蝠", ViewEnemyTile.bigBat, enemyPresets.bigbat),
        genEnemyTemplate("骷髅", ViewEnemyTile.skeleton, enemyPresets.skeleton),
        genEnemyTemplate("初级卫兵", ViewEnemyTile.yellowGuard, enemyPresets.guard),
        genEnemyTemplate("骷髅士兵", ViewEnemyTile.skeletonSoilder, enemyPresets.skeleton),
        genEnemyTemplate("红蝙蝠", ViewEnemyTile.redBat, enemyPresets.bigbat),
    ], {
        initHero: initStatus.hero,
        values: values,
        stage: [1, 1, 1],
    });
    projectData.enemies = enemies;
};

const doGenMapBaseStep = () => {
    const { mapCount, initLoc } = cloneDeep(toRaw(projectData));
    const mapCtxs = genMapBase({
        mapCount,
        startLoc: initLoc,
    });
    mapBaseContexts.value = cloneDeep(mapCtxs);
};

const doGenMapRoomStep = () => {
    const mapCtxs = genMapRoom(mapBaseContexts.value, {
        roomSizeFactor: 1,
    });
    mapRoomContexts.value = mapCtxs;
};

const doGenMapPlotStep = () => {
    const { potions, gems, enemies, values } = cloneDeep(toRaw(projectData));
    const mapCtxs = genMapPlot(mapRoomContexts.value, {
        stages: [1, 1, 1],
        events: {
            potions,
            gems,
            enemies,
        },
        values,
        initStatus,
    });
    mapPlotContexts.value = cloneDeep(mapCtxs);
};

const doLoadMap = () => {
    projectData.maps = mapPlotContexts.value.map((e) => e.blockMap);
};

const pipeline = [
    doGenEnemiesStep,
    doGenMapBaseStep,
    doGenMapRoomStep,
    doGenMapPlotStep,
    doLoadMap,
];

const runPipeline = (fromStep: number) => {
    pipeline.slice(fromStep).forEach((action) => {
        action();
    });
}

setTimeout(() => {
    try {
        runPipeline(0);
    } catch (e) {
        console.error(e);
    }
});

const currentContexts = computed(() => {
    switch (currentStep.value) {
        case 1: return mapBaseContexts.value;
        case 2: return mapRoomContexts.value;
        case 3: return mapPlotContexts.value;
        default: return void 0;
    }
});

const downloadContext = (contexts: MapContext[]) => {
    downloadTextFile("contexts.json", JSON.stringify(contexts));
};

</script>
<template>
    <div class="main">
        <div class="title">
            <Steps :items="STEPS" v-model:current="currentStep" />
        </div>
        <div v-if="currentStep === 0">
            <EnemyTable :data="projectData.enemies" />
        </div>
        <div v-if="currentContexts">
            <div class="controller">
                <div>mark: <Switch v-model:checked="showMark" /></div> 
                <div>debug: <Switch v-model:checked="showDebug" /></div>
                <div>
                    <Button :icon="h(ReloadOutlined)" @click="runPipeline(currentStep)" size="small">
                        重新生成
                    </Button>
                </div>
                <div>
                    <Button :icon="h(DownloadOutlined)" @click="downloadContext(currentContexts)" size="small">
                        下载
                    </Button>
                </div>
            </div>
            <MapViews
                :contexts="currentContexts"
                :showMark="showMark"
                :showDebug="showDebug"
            />
        </div>
        <div v-if="currentStep === STEPS.length-1">
            <OutputPanel />
        </div>
    </div>
</template>

<style>
html, body {
    margin: 0;
    padding: 0;
}
</style>

<style lang="less" scoped>
.main {
    margin: auto;
    width: 99%;
}
.title {
    margin: 20px auto;
    width: 800px;
}
.controller {
    display: flex;
    margin-bottom: 10px;
    div {
        margin-left: 20px;
    }
}
</style>
