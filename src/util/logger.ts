import util from 'util'
import 'winston-mongodb'
import { createLogger, format, transports } from 'winston'
import config from '../config/config'
import { EApplicationEnvironment } from '../constant/application'
import path from 'path'
import { red, blue, yellow, green, magenta } from 'colorette'
import { ConsoleTransportInstance, FileTransportInstance } from 'winston/lib/winston/transports'
import { MongoDBTransportInstance } from 'winston-mongodb'
import * as sourceMapSupport from 'source-map-support'

// Linking Trace Support
sourceMapSupport.install()

const colorizeLevel = (level: string) => {
    switch (level) {
        case 'ERROR':
            return red(level)
        case 'INFO':
            return blue(level)
        case 'WARN':
            return yellow(level)
        default:
            return level
    }
}

const consoleLogFormat = format.printf((info) => {
    const { level, message, timestamp, meta = {} } = info as {
        level: string;
        message: string;
        timestamp: string;
        meta?: Record<string, unknown>;
    };

    const customLevel = typeof level === 'string' ? colorizeLevel(level.toUpperCase()) : 'UNKNOWN'
    const customTimestamp = green(timestamp)

    const customMeta = typeof meta === 'object' ? util.inspect(meta, {
        showHidden: false,
        depth: null,
        colors: true
    }) : String(meta)

    return `${customLevel} [${customTimestamp}] ${message}\n${magenta('META')} ${customMeta}\n`
})

const consoleTransport = (): Array<ConsoleTransportInstance> => {
    if (config.ENV === EApplicationEnvironment.DEVELOPMENT) {
        return [
            new transports.Console({
                level: 'info',
                format: format.combine(format.timestamp(), consoleLogFormat)
            })
        ]
    }

    return []
}

const fileLogFormat = format.printf((info: Record<string, unknown>) => {
    const { level, message, timestamp, meta = {} } = info as {
        level: string;
        message: string;
        timestamp: string;
        meta?: Record<string, unknown>;
    };

    const logMeta: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(meta)) {
        if (value instanceof Error) {
            logMeta[key] = {
                name: value.name,
                message: value.message,
                trace: value.stack || ''
            }
        } else {
            logMeta[key] = value
        }
    }

    const logData = {
        level: level.toUpperCase(),
        message,
        timestamp,
        meta: logMeta
    }

    return JSON.stringify(logData, null, 4)
})

const FileTransport = (): Array<FileTransportInstance> => {
    return [
        new transports.File({
            filename: path.join(__dirname, '../', '../', 'logs', `${config.ENV}.log`),
            level: 'info',
            format: format.combine(format.timestamp(), fileLogFormat)
        })
    ]
}

const MongodbTransport = (): Array<MongoDBTransportInstance> => {
    return [
        new transports.MongoDB({
            level: 'info',
            db: config.DATABASE_URL as string,
            metaKey: 'meta',
            expireAfterSeconds: 3600 * 24 * 30,
            options: {
                useUnifiedTopology: true
            },
            collection: 'application-logs'
        })
    ]
}

export default createLogger({
    defaultMeta: {
        meta: {}
    },
    transports: [...FileTransport(), ...MongodbTransport(), ...consoleTransport()]
})
