// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Swappable access gate. Returns whether `user` may send a message.
interface IQcipherGate {
    function canSend(address user) external view returns (bool);
}

/// @title Qcipher Messenger
/// @notice Writes end-to-end encrypted messages on-chain as events. The contract
///         never sees plaintext — confidentiality, integrity, and sender
///         authenticity are enforced entirely by the Qcipher crypto core. A
///         swappable gate decides who may send (e.g. $PENT holders); an unset
///         gate means open to all.
contract Messenger {
    /// @dev Hard cap on payload size to bound calldata griefing. Covers the
    ///      largest padding bucket plus the first-message handshake.
    uint256 public constant MAX_PAYLOAD = 131072;

    address public owner;
    address public pendingOwner;
    IQcipherGate public gate;

    /// @param convoId keccak of the sorted participant keys (keeps the raw
    ///                recipient address out of the clear in v1).
    /// @param epoch   rotor epoch the message was sealed under.
    /// @param payload canonical Qcipher wire envelope (authenticated header + ciphertext).
    event Message(bytes32 indexed convoId, uint64 epoch, bytes payload);
    event GateUpdated(address indexed gate);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error NotAllowed();
    error PayloadTooLarge();
    error ZeroAddress();
    error NotPendingOwner();

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /// @notice Send one encrypted message. The caller need not be a conversation
    ///         participant (this enables v2 relayers / meta-tx); the crypto core
    ///         is what authenticates the actual sender.
    function send(bytes32 convoId, uint64 epoch, bytes calldata payload) external {
        if (payload.length > MAX_PAYLOAD) revert PayloadTooLarge();
        IQcipherGate g = gate;
        if (address(g) != address(0) && !g.canSend(msg.sender)) revert NotAllowed();
        emit Message(convoId, epoch, payload);
    }

    /// @notice Swap the access gate. `address(0)` opens sending to everyone.
    function setGate(address newGate) external onlyOwner {
        gate = IQcipherGate(newGate);
        emit GateUpdated(newGate);
    }

    /// @notice Step 1 of 2 — the owner nominates a new owner (e.g. a multisig).
    ///         Nothing changes until the nominee accepts.
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    /// @notice Step 2 of 2 — the nominee accepts, completing the transfer. The
    ///         2-step flow prevents handing ownership to an address that can't act
    ///         (e.g. a typo), and is multisig-friendly.
    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotPendingOwner();
        emit OwnershipTransferred(owner, pendingOwner);
        owner = pendingOwner;
        pendingOwner = address(0);
    }
}
