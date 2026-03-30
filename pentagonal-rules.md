# Pentagonal Security Rules

_Self-healing rules learned from AI pen testing._
_These rules are injected into contract generation prompts when Learning is ON._
_Last updated: 2026-03-30T00:38:15.175Z_

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
11. Always use ReentrancyGuard with nonReentrant modifier on all functions that make external calls before updating state
12. Implement contract-level reentrancy protection to prevent cross-function reentrancy attacks between different public functions
13. Update state variables before making external calls to prevent manipulation during reentrancy windows
14. Apply proper access control modifiers like onlyOwner to all administrative functions that modify critical contract parameters
15. Implement and verify all access control functions before deploying contracts with role-based permissions
16. Add array length limits and gas consumption checks to prevent DoS attacks in batch operations
17. Implement maximum array size limits for user-controlled data structures to prevent gas griefing attacks
18. Use price oracles with proper validation and manipulation protection for token price conversions
19. Avoid hardcoding external contract addresses that could become deprecated or compromised
20. Ensure all emergency functions have complete implementations with proper state management and access controls
21. Validate that all referenced internal functions are implemented before contract deployment
