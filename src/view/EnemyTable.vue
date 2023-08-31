<script lang="tsx" setup>
import { Enemy, ENEMY_SPECIAL_MAP } from '@/gen/genEnemy';
import { Table, Tag } from 'ant-design-vue';
import { ColumnProps } from 'ant-design-vue/es/table';
import MapView from './MapView.vue';

defineProps<{ data: Enemy[] }>();

const columns: ColumnProps<Enemy>[] = [
    {
        title: '',
        dataIndex: 'tile',
        customRender: ({ record }) => (
            <MapView
                tileMap={[[record.tile]]}
                venderMap={[[[]]]}
            />
        )
    },
    {
        title: '名称',
        dataIndex: 'name'
    },
    {
        title: '特性',
        dataIndex: 'special',
        customRender: ({ record }) => (
            <div>{record.special.map(e => <Tag>{ENEMY_SPECIAL_MAP[e]}</Tag>)}</div>
        )
    },
    {
        title: '血量',
        dataIndex: 'hp'
    },
    {
        title: '攻击',
        dataIndex: 'atk'
    },
    {
        title: '防御',
        dataIndex: 'def'
    }
];

</script>
<template>
    <Table
        style="max-width: 500px; margin: auto;"
        :dataSource="data"
        :columns="columns"
        :pagination="false"
        size="small"
    />
</template>
<style>
</style>