import { encodeFunctionData, parseAbi, toRlp, Hex } from 'viem';

export const CONSENSUS_DISPATCHER_ADDRESS = '0x0000000000000000000000000000000000000000';

const ADD_TX_ABI = parseAbi([
  'function addTransaction(address sender, address recipient, uint256 numValidators, uint256 maxRotations, bytes data) returns (bytes32)'
]);

// GenLayer binary calldata type constants (ULEB128 tagged)
const BITS_IN_TYPE = 3;
const TYPE_SPECIAL = 0;
const TYPE_PINT = 1;
const TYPE_NINT = 2;
const TYPE_BYTES = 3;
const TYPE_STR = 4;
const TYPE_ARR = 5;
const TYPE_MAP = 6;

const SPECIAL_NULL = (0 << BITS_IN_TYPE) | TYPE_SPECIAL;
const SPECIAL_FALSE = (1 << BITS_IN_TYPE) | TYPE_SPECIAL;
const SPECIAL_TRUE = (2 << BITS_IN_TYPE) | TYPE_SPECIAL;

export function encodeGenLayerCalldata(val: any): Hex {
  const bytes: number[] = [];

  function appendUleb128(i: number) {
    if (i === 0) {
      bytes.push(0);
      return;
    }
    let curVal = i;
    while (curVal > 0) {
      let cur = curVal & 0x7f;
      curVal = curVal >> 7;
      if (curVal > 0) cur |= 0x80;
      bytes.push(cur);
    }
  }

  function implDict(obj: Record<string, any>) {
    const keys = Object.keys(obj).sort();
    appendUleb128((keys.length << BITS_IN_TYPE) | TYPE_MAP);
    for (const k of keys) {
      const kBytes = new TextEncoder().encode(k);
      appendUleb128(kBytes.length);
      for (const b of kBytes) bytes.push(b);
      impl(obj[k]);
    }
  }

  function impl(b: any) {
    if (b === null || b === undefined) {
      bytes.push(SPECIAL_NULL);
    } else if (b === true) {
      bytes.push(SPECIAL_TRUE);
    } else if (b === false) {
      bytes.push(SPECIAL_FALSE);
    } else if (typeof b === 'number' || typeof b === 'bigint') {
      const num = Number(b);
      if (num >= 0) {
        appendUleb128((num << BITS_IN_TYPE) | TYPE_PINT);
      } else {
        const inv = -num - 1;
        appendUleb128((inv << BITS_IN_TYPE) | TYPE_NINT);
      }
    } else if (typeof b === 'string') {
      const strBytes = new TextEncoder().encode(b);
      appendUleb128((strBytes.length << BITS_IN_TYPE) | TYPE_STR);
      for (const byte of strBytes) bytes.push(byte);
    } else if (Array.isArray(b)) {
      appendUleb128((b.length << BITS_IN_TYPE) | TYPE_ARR);
      for (const x of b) impl(x);
    } else if (typeof b === 'object') {
      implDict(b);
    } else {
      throw new Error(`Unsupported type for GenLayer calldata: ${typeof b}`);
    }
  }

  impl(val);
  return ('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')) as Hex;
}

/**
 * Builds the exact ABI-encoded addTransaction payload for GenLayer consensus.
 * Dispatches to 0x0000000000000000000000000000000000000000 to trigger 5 AI Validators.
 */
export function buildAddTransactionPayload(
  senderAddress: string,
  targetContractAddress: string,
  methodName: string,
  methodArgs: any[],
  numValidators: bigint = 5n,
  maxRotations: bigint = 3n
): Hex {
  const calldataObject = {
    method: methodName,
    args: methodArgs,
  };

  const calldataHex = encodeGenLayerCalldata(calldataObject);
  // serialize as [calldata, false] where false in RLP is empty byte sequence '0x'
  const serializedData = toRlp([calldataHex, '0x']);

  return encodeFunctionData({
    abi: ADD_TX_ABI,
    functionName: 'addTransaction',
    args: [
      senderAddress as `0x${string}`,
      targetContractAddress as `0x${string}`,
      numValidators,
      maxRotations,
      serializedData,
    ],
  });
}
