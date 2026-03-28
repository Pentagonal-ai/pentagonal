# Pentagonal Security Rules

_Self-healing rules learned from AI pen testing._
_These rules are injected into contract generation prompts when Learning is ON._
_Last updated: 2026-03-27T23:00:00.000Z_

---

1. Always add reentrancy guards to functions that transfer ETH or tokens
2. Use OpenZeppelin's ReentrancyGuard instead of custom mutex patterns
3. Never allow unchecked external calls in loops
4. Validate all function inputs with require statements before processing
5. Use SafeMath or Solidity 0.8+ checked arithmetic for all calculations
6. Emit events for all state-changing operations
7. Implement access control on all admin functions using OpenZeppelin's Ownable or AccessControl
8. Never use tx.origin for authorization — always use msg.sender
9. Set visibility explicitly on all functions and state variables
10. Use pull-over-push pattern for ETH transfers to avoid DoS
