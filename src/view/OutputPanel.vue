<script lang="ts" setup>
import { Button } from 'ant-design-vue';
import { tileImagesLoaded } from './tile';
import { outputProject } from '@/output/outputProject';
import { projectData } from './store';
import { ref, toRaw } from 'vue';

const log = ref<string[]>([]);

const output = async () => {
    log.value = [];
    try {
        await outputProject(toRaw(projectData), (str) => log.value.push(str));
    } catch (e) {
        log.value.push(String(e));
        console.error(e);
    }
}
</script>
<template>
    <div class="output-panel">
        <Button type="primary" :disabled="!tileImagesLoaded" @click="output">输出工程</Button>
        <pre class="log">{{ log.join('\n') }}</pre>
    </div>
</template>
<style lang="less" scoped>
.output-panel {
    margin: auto;
    width: 800px;
}
.log {
    font-size: 14px;
    font-family: "Consolas", "menlo", monospace;
    background-color: #EEEEEE;
    padding: 8px;
    white-space: pre-wrap;
}
</style>