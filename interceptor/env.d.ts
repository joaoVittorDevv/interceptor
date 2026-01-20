/// <reference types="vite/client" />

declare module '*.vue' {
    import type { DefineComponent } from 'vue'
    const component: DefineComponent<{}, {}, any>
    export default component
}

// vue-virtual-scroller doesn't have official type declarations
declare module 'vue-virtual-scroller' {
    import { DefineComponent } from 'vue'

    export const RecycleScroller: DefineComponent<{
        items: any[]
        keyField?: string
        direction?: 'vertical' | 'horizontal'
        itemSize?: number | null
    }>

    export const DynamicScroller: DefineComponent<{
        items: any[]
        keyField?: string
        direction?: 'vertical' | 'horizontal'
        minItemSize?: number
    }>

    export const DynamicScrollerItem: DefineComponent<{
        item: any
        active?: boolean
        sizeDependencies?: any[]
    }>
}
