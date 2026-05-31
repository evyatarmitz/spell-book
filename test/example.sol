// SPDX-License-Identifier: MIT
// Solidity example — Code Scavenge test file
pragma solidity ^0.8.20;

// ── Structs ───────────────────────────────────────────────────

struct Proposal {
    string  description;
    uint256 voteCount;
    bool    executed;
}

struct Transfer {
    address from;
    address to;
    uint256 amount;
    uint256 timestamp;
}

// ── Enums ─────────────────────────────────────────────────────

enum Status   { Pending, Active, Closed }
enum VoteType { Against, For, Abstain }

// ── Events ────────────────────────────────────────────────────

event Transfer(address indexed from, address indexed to, uint256 value);
event Approval(address indexed owner, address indexed spender, uint256 value);

// ── Interfaces ────────────────────────────────────────────────

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
}

// ── Library ───────────────────────────────────────────────────

library SafeMath {
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "overflow");
        return c;
    }

    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b <= a, "underflow");
        return a - b;
    }
}

// ── Contract ──────────────────────────────────────────────────

contract Token is IERC20 {
    using SafeMath for uint256;

    string public name;
    string public symbol;
    uint256 private _totalSupply;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    modifier onlyPositive(uint256 amount) {
        require(amount > 0, "amount must be positive");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    address public owner;

    constructor(string memory _name, string memory _symbol, uint256 initialSupply) {
        name         = _name;
        symbol       = _symbol;
        owner        = msg.sender;
        _totalSupply = initialSupply;
        _balances[msg.sender] = initialSupply;
    }

    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }

    function transfer(address to, uint256 amount)
        external override onlyPositive(amount) returns (bool)
    {
        _balances[msg.sender] = SafeMath.sub(_balances[msg.sender], amount);
        _balances[to]         = SafeMath.add(_balances[to], amount);
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _totalSupply      = SafeMath.add(_totalSupply, amount);
        _balances[to]     = SafeMath.add(_balances[to], amount);
    }

    function burn(uint256 amount) external onlyPositive(amount) {
        _balances[msg.sender] = SafeMath.sub(_balances[msg.sender], amount);
        _totalSupply          = SafeMath.sub(_totalSupply, amount);
    }
}
