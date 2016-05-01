'use strict';

import {SimpleError, ErrFunc, VoidFunc, ValFunc} from './util';
import {Context, User, ModeActions, Mode, Node} from './interface';

class NodeBase {
    constructor(
        private _mode: Mode, // mutable
        private _owner: User // mutable
    ) {
        //
    }

    protected _read(context: Context, callback: VoidFunc, fail: ErrFunc) {
        this._mode.check(context, this._owner, ModeActions.read, callback, fail);
    }

    protected _write(context: Context, callback: VoidFunc, fail: ErrFunc) {
        this._mode.check(context, this._owner, ModeActions.write, callback, fail);
    }

    protected _exec(context: Context, callback: VoidFunc, fail: ErrFunc) {
        this._mode.check(context, this._owner, ModeActions.exec, callback, fail);
    }

    protected _attr(context: Context, callback: VoidFunc, fail: ErrFunc) {
        this._mode.check(context, this._owner, ModeActions.attr, callback, fail);
    }

    getattr(
        context: Context,
        callback: (mode: Mode, owner: User) => void, fail: ErrFunc
    ): void {
        callback(this._mode, this._owner);
    }

    chmod(
        context: Context, mode: Mode,
        callback: VoidFunc, fail: ErrFunc
    ): void {
        this._attr(context, (): void => {
            this._mode = mode;
        }, fail);
    }

    chown(
        context: Context, owner: User,
        callback: VoidFunc, fail: ErrFunc
    ): void {
        this._attr(context, (): void => {
            this._owner = owner;
        }, fail);
    }
};

export class DirNode extends NodeBase implements Node {
    private static tag: string = 'ENTRY_';
    private _map: {[key: string]: Node} = {}; // mutable

    constructor(mode: Mode, owner: User, list: [string, Node][]) {
        super(mode, owner);

        for (const pair of list) {
            this._map[DirNode.tag + pair[0]] = pair[1];
        };
    }

    readdir(
        context: Context,
        callback: ValFunc<string[]>, fail: ErrFunc
    ): void {
        this._read(context, (): void => {
            let result: string[] = [];

            for (const name in this._map) {
                result.push(name.slice(DirNode.tag.length));
            }

            callback(result);
        }, fail);
    }

    link(
        context: Context, name: string, node: Node,
        callback: VoidFunc, fail: ErrFunc
    ): void {
        this._write(context, (): void => {
            const result: Node = this._map[DirNode.tag + name];

            if (result !== undefined) {
                fail(new SimpleError('file exists'));
            } else {
                this._map[DirNode.tag + name] = node;
                callback();
            }
        }, fail);
    }

    unlink(
        context: Context, name: string,
        callback: VoidFunc, fail: ErrFunc
    ): void {
        this._write(context, (): void => {
            const result: Node = this._map[DirNode.tag + name];

            if (result !== undefined) {
                delete this._map[DirNode.tag + name];
                callback();
            } else {
                fail(new SimpleError('file not found'));
            }
        }, fail);
    }

    swap(
        context: Context, name: string, node: Node,
        callback: VoidFunc, fail: ErrFunc
    ): void {
        this._write(context, (): void => {
            const result: Node = this._map[DirNode.tag + name];

            if (result !== undefined) {
                this._map[DirNode.tag + name] = node;
                callback();
            } else {
                fail(new SimpleError('file not found'));
            }
        }, fail);
    }

    open(
        context: Context, name: string,
        callback: ValFunc<Node>, fail: ErrFunc
    ): void {
        this._exec(context, (): void => {
            const result: Node = this._map[DirNode.tag + name];

            if (result !== undefined) {
                callback(result);
            } else {
                fail(new SimpleError('file not found'));
            }
        }, fail);
    }
};

export class LinkNode extends NodeBase implements Node {
    constructor(
        mode: Mode,
        owner: User,
        private _path: string[] // mutable
    ) {
        super(mode, owner);
    }

    readlink(
        context: Context,
        callback: ValFunc<string[]>, fail: ErrFunc
    ): void {
        this._read(context, (): void => {
            callback(this._path);
        }, fail);
    }

    writelink(
        context: Context, path: string[],
        callback: VoidFunc, fail: ErrFunc
    ): void {
        this._write(context, (): void => {
            this._path = path;
            callback();
        }, fail);
    }

    trace(
        context: Context, path: string[],
        callback: ValFunc<string[]>, fail: ErrFunc
    ): void {
        this._exec(context, (): void => {
            callback(path.concat(this._path));
        }, fail);
    }
};

export class FreeObjNode extends NodeBase implements Node {
    private _obj: any; // mutable

    constructor(mode: Mode, owner: User, obj: any) {
        super(mode, owner);

        this._obj = obj;
    }

    readobj(
        context: Context,
        callback: ValFunc<any>, fail: ErrFunc
    ): void {
        this._read(context, (): void => {
            callback(this._obj);
        }, fail);
    }

    writeobj(
        context: Context, obj: any,
        callback: VoidFunc, fail: ErrFunc
    ): void {
        this._write(context, (): void => {
            this._obj = obj;
            callback();
        }, fail);
    }
};

export class JsonObjNode extends NodeBase implements Node {
    private _json: string; // mutable

    constructor(mode: Mode, owner: User, obj: any) {
        super(mode, owner);

        this._json = JSON.stringify(obj);
    }

    readobj(
        context: Context,
        callback: ValFunc<any>, fail: ErrFunc
    ): void {
        this._read(context, (): void => {
            callback(JSON.parse(this._json));
        }, fail);
    }

    writeobj(
        context: Context, obj: any,
        callback: VoidFunc, fail: ErrFunc
    ): void {
        this._write(context, (): void => {
            this._json = JSON.stringify(obj);
            callback();
        }, fail);
    }
};
