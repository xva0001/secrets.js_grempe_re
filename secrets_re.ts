// @preserve author Alexander Stetsyuk
// @preserve author Glenn Rempe <glenn@rempe.us>
// @license MIT

/*jslint passfail: false, bitwise: true, nomen: true, plusplus: true, todo: false, maxerr: 1000 */
/*global define, require, module, exports, window, Uint32Array */

// eslint : http://eslint.org/docs/configuring/
/*eslint-env node, browser, jasmine */
/*eslint no-underscore-dangle:0 */

// UMD (Universal Module Definition)
// Uses Node, AMD or browser globals to create a module. This module creates
// a global even when AMD is used. This is useful if you have some scripts
// that are loaded by an AMD loader, but they still want access to globals.
// See : https://github.com/umdjs/umd
// See : https://github.com/umdjs/umd/blob/master/returnExportsGlobal.js
//

import forge from "node-forge";

// 配置物件的型別

interface Config {
    bits: number;
    maxShares: number;
    logs: number[];
    exps: number[];
}

interface Share {
    x: number;
    y: number;
}

const config_re: Config = {
    bits: 8, // 假設每段是 8 位
    maxShares: 255, // 假設有限域的大小
    logs: [], // 需初始化為適當的對數表
    exps: [], // 需初始化為適當的指數表
};




//https://www.ecice06.com/CN/10.3969/j.issn.1000-3428.2008.15.052



const settings = {
    bits: 8,
    radix: 16,
    minBits: 3,
    maxBits: 20, // this permits 1,048,575 shares,
    //  though going this high is NOT recommended in JS!
    bytesPerChar: 2,
    maxBytesPerChar: 6, // Math.pow(256,7) > Math.pow(2,53)


    // Primitive polynomials (in decimal form) for Galois Fields GF(2^n), for 2 <= n <= 30
    // The index of each term in the array corresponds to the n for that polynomial
    // i.e. to get the polynomial for n=16, use primitivePolynomials[16]
    primitivePolynomials: [
        null, null, 1, 3, 3,
        5, 3, 3, 29, 17,
        9, 5, 83, 27, 43,
        3, 45, 9, 39, 39,
        9, 5, 3, 33, 27,
        9, 71, 39, 9, 5, 83
    ]
}


export class Secrets {

    // 產生對數表和指數表
    static initTables() {
        // 產生對數表和指數表
        let x = 1;
        for (let i = 0; i < config_re.maxShares; i++) {
            config_re.exps[i] = x;
            config_re.logs[x] = i;
            x = x << 1;
            if (x >= config_re.maxShares) {
                x = x ^ config_re.maxShares;
                x = x ^ 283;
            }
        }
    }

    // 將字串轉換為數字陣列
    static strToNumArray(str: string): number[] {
        const numArray: number[] = [];
        for (let i = 0; i < str.length; i++) {
            numArray.push(str.charCodeAt(i));
        }
        return numArray;
    }

    // 將數字陣列轉換為字串
    static numArrayToStr(numArray: number[]): string {
        let str = '';
        for (let i = 0; i < numArray.length; i++) {
            str += String.fromCharCode(numArray[i]);
        }
        return str;
    }

    // 將數字陣列轉換為 16 進位字串
    static numArrayToHex(numArray: number[]): string {
        let hex = '';
        for (let i = 0; i < numArray.length; i++) {
            hex += ('0' + numArray[i].toString(16)).slice(-2);
        }
        return hex;
    }

    // 將 16 進位字串轉換為數字陣列
    static hexToNumArray(hex: string): number[] {
        const numArray: number[] = [];
        for (let i = 0; i < hex.length; i += 2) {
            numArray.push(parseInt(hex.substr(i, 2), 16));
        }
        return numArray;
    }

    // 將字串轉換為 16 進位字串
    static strToHex(str: string): string {
        return this.numArrayToHex(this.strToNumArray(str));
    }

    static padLeft(str: string, multipleOfBits: number): string {
        let preGenPadding = new Array(1024).join("0")
        if (multipleOfBits === 0 || multipleOfBits === 1) {
            return str; // 如果倍數為 0 或 1，直接返回
        }

        if (multipleOfBits > 1024) {
            throw new Error("Padding must be multiples of no larger than 1024 bits.");
        }

        multipleOfBits = multipleOfBits || config.bits; // 使用預設位數

        if (str) {
            const missing = str.length % multipleOfBits; // 計算需要補零的位數
            if (missing) {
                return (preGenPadding + str).slice(-(multipleOfBits - missing + str.length));
            }
        }

        return str; // 如果不需要補零，返回原始字串
    }

    static hex2bin(str: string): string {
        return str.split('').reverse().map(char => {
            const num = parseInt(char, 16);
            if (isNaN(num)) {
                throw new Error("Invalid hex character.");
            }
            return num.toString(2).padStart(4, '0');
        }).reverse().join('');
    }

    static bin2hex(str: string): string {
        str = str.padStart(Math.ceil(str.length / 4) * 4, '0');
        let hex = '';
        for (let i = 0; i < str.length; i += 4) {
            const num = parseInt(str.slice(i, i + 4), 2);
            if (isNaN(num)) {
                throw new Error("Invalid binary character.");
            }
            hex += num.toString(16);
        }
        return hex;
    }
    static getRNG(bits: number = settings.bits, arr?: number[], radix: number = settings.radix, size: number = 4): string {
        // 計算所需的位元組數
        let bytes = Math.ceil(bits / 8);

        // 初始化隨機字串結果
        let str = "";

        // 使用 forge 庫生成隨機位元組
        let buf = forge.random.getBytesSync(bytes);

        // 將位元組轉換為指定進制的字串
        for (let i = 0; i < buf.length; i++) {
            // 將字節轉換為整數值
            let value = buf.charCodeAt(i);

            // 如果有 `arr`，根據數值選擇字符
            if (arr && arr.length > 0) {
                str += arr[value % arr.length];
            } else {
                // 否則根據指定進制轉換
                str += value.toString(radix).padStart(size, '0'); // 確保固定長度
            }
        }
        // 返回生成的隨機字串
        return str.slice(0, Math.ceil(bits / (Math.log2(radix)))); // 裁剪到所需長度
    }


    static splitNumStringToIntArray(
        str: string,
        padLength?: number
    ): number[] {
        const parts: number[] = [];

        // 如果有 padLength，先對字串進行填充
        if (padLength) {
            str = this.padLeft(str, padLength);
        }

        // 從尾部開始按 config.bits 切割
        for (let i = str.length; i > config.bits; i -= config.bits) {
            const segment = str.slice(i - config.bits, i);
            parts.push(parseInt(segment, 2)); // 將二進位子字串轉換為整數
        }

        // 處理剩餘不足 config.bits 的部分
        if (str.length > 0) {
            parts.push(parseInt(str.slice(0, str.length), 2));
        }

        return parts;
    }

    // Horner 方法計算多項式值
    static horner(x: number, coeffs: number[]): number {
        const logx = config.logs[x]; // 取 x 的對數值
        let fx = 0;

        // 從高次項到低次項計算
        for (let i = coeffs.length - 1; i >= 0; i--) {
            if (fx !== 0) {
                fx =
                    config.exps[(logx + config.logs[fx]) % config.maxShares] ^
                    coeffs[i];
            } else {
                fx = coeffs[i];
            }
        }

        return fx;
    }


    // Evaluate the Lagrange interpolation polynomial at x = `at`
    // using x and y Arrays that are of the same length, with
    // corresponding elements constituting points on the polynomial.
    //拉格朗日插值多項式
    static lagrange(at: number, x: number[], y: number[], config: Config): number {
        let sum = 0; // 插值多項式的結果
        const len = x.length;

        for (let i = 0; i < len; i++) {
            if (!y[i]) continue; // 跳過 y[i] 為 0 的情況

            let product = config.logs[y[i]]; // 初始化 product 為 log(y[i])

            for (let j = 0; j < len; j++) {
                if (i === j) continue; // 跳過自己

                if (at === x[j]) {
                    product = -1; // 特殊情況，直接設為 -1
                    break;
                }

                const atXorXj = at ^ x[j];
                const xiXorXj = x[i] ^ x[j];
                product = (product + config.logs[atXorXj] - config.logs[xiXorXj] + config.maxShares) % config.maxShares;
            }

            // 累積到 sum，檢查特殊情況
            sum = product === -1 ? sum : sum ^ config.exps[product];
        }

        return sum;
    }



    static getShares(secret: number, numShares: number, threshold: number, config: { bits: number, rng: (bits: number) => string }): Share[] {
        const shares: Share[] = [];
        const coeffs: number[] = [secret];

        // 隨機生成多項式的其他係數
        for (let i = 1; i < threshold; i++) {
            coeffs[i] = parseInt(config.rng(config.bits), 2); // 生成隨機係數
        }

        // 計算每個共享值 (x, y)
        for (let i = 1; i <= numShares; i++) {
            shares.push({
                x: i,
                y: this.horner(i, coeffs) // 使用霍納法則計算 P(x)
            });
        }

        return shares;
    }



    static constructPublicShareString(bits: number, id: number, data: string, config: { radix: number }): string {
        // 驗證並解析參數
        const parsedBits = parseInt(bits.toString(), 10) || settings.bits;
        const parsedId = parseInt(id.toString(), config.radix);
        const bitsBase36 = parsedBits.toString(36).toUpperCase();
        const idMax = (1 << parsedBits) - 1; // 2^bits - 1
        const idPaddingLen = idMax.toString(config.radix).length;
        const idHex = this.padLeft(parsedId.toString(config.radix), idPaddingLen);

        // 驗證 ID 的範圍
        if (!Number.isInteger(parsedId) || parsedId < 1 || parsedId > idMax) {
            throw new Error(`Share id must be an integer between 1 and ${idMax}, inclusive.`);
        }

        // 拼接共享字符串
        return bitsBase36 + idHex + data;
    }

    //--------------------------------end of static--------------------------------------------------------------------------------------------





}