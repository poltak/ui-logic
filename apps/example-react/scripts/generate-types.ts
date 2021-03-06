import kebabCase from 'lodash/kebabCase'
import * as fs from 'fs'
import * as path from 'path'
import StorageManager, { StorageRegistry } from '@worldbrain/storex';
import { StorageModule } from '@worldbrain/storex-pattern-modules'
import { generateTypescriptInterfaces } from '@worldbrain/storex-typescript-generation'
import { createStorage } from '../src/storage'

type StorageModuleInfoMap = { [className : string] : StorageModuleInfo }
interface StorageModuleInfo {
    path : string
    baseNameWithoutExt : string
    isSingleFile : boolean
}

export async function main() {
    const rootTypesPath = path.join(__dirname, '../src/types/storex-generated')
    if (!fs.existsSync(rootTypesPath)){
        fs.mkdirSync(rootTypesPath)
    }

    const storage = await createStorage({ backend: 'memory' })
    const storageModuleInfoMap = collectStorageModuleInfo()
    for (const [storageModuleName, storageModule] of Object.entries(storage.modules)) {
        const className = Object.getPrototypeOf(storageModule).constructor.name
        const storageModuleInfo = storageModuleInfoMap[className]
        const types = generateTypesForStorageModule(storageModule, { storageModuleInfo, storageRegistry: storage.manager.registry })

        const moduleTypesPath = path.join(rootTypesPath, `${storageModuleInfo.baseNameWithoutExt}.ts`)
        fs.writeFileSync(moduleTypesPath, types)
    }
}

function collectStorageModuleInfo() : StorageModuleInfoMap {
    const infoMap : StorageModuleInfoMap = {}

    const storageModulesPath = path.join(__dirname, '../src/storage/modules')
    const storageModuleBaseNames = fs.readdirSync(storageModulesPath)
    for (const storageModuleBaseName of storageModuleBaseNames) {
        const storageModulePath = path.join(storageModulesPath, storageModuleBaseName)
        const StorageModuleClass = require(storageModulePath).default
        if (typeof StorageModuleClass !== 'function') {
            console.log(`Skipping module storage/modules/${storageModuleBaseName}`)
        }

        const isSingleFile = /\.ts$/.test(storageModuleBaseName)
        const storageModuleClasName = StorageModuleClass.name
        
        infoMap[storageModuleClasName] = {
            path: storageModulePath,
            isSingleFile,
            baseNameWithoutExt: /(.+)\.ts$/.exec(storageModuleBaseName)[1]
        }
    }

    return infoMap
}

function generateTypesForStorageModule(storageModule : StorageModule, options : {
    storageModuleInfo : StorageModuleInfo, storageRegistry : StorageRegistry
}) : string {
    const collections = Object.keys(storageModule.getConfig().collections || {})
    const interfaces = generateTypescriptInterfaces(options.storageRegistry, {
        autoPkType: 'generic',
        collections,
        generateImport: (options) => {
            return { path: `./${kebabCase(options.collectionName)}.ts` }
        }
    })
    return interfaces
}

if(require.main === module) {
    main()
}
