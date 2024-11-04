├─ type: SourceUnit
└─ children
   ├─ 0
   │  ├─ type: PragmaDirective
   │  ├─ name: solidity
   │  └─ value: ^0.8.0
   ├─ 1
   │  ├─ type: ImportDirective
   │  ├─ path: @openzeppelin/contracts/token/ERC721/ERC721.sol
   │  ├─ pathLiteral
   │  │  ├─ type: StringLiteral
   │  │  ├─ value: @openzeppelin/contracts/token/ERC721/ERC721.sol
   │  │  ├─ parts
   │  │  │  └─ 0: @openzeppelin/contracts/token/ERC721/ERC721.sol
   │  │  └─ isUnicode
   │  │     └─ 0: false
   │  ├─ unitAlias
   │  ├─ unitAliasIdentifier
   │  ├─ symbolAliases
   │  └─ symbolAliasesIdentifiers
   ├─ 2
   │  ├─ type: ImportDirective
   │  ├─ path: @openzeppelin/contracts/utils/Counters.sol
   │  ├─ pathLiteral
   │  │  ├─ type: StringLiteral
   │  │  ├─ value: @openzeppelin/contracts/utils/Counters.sol
   │  │  ├─ parts
   │  │  │  └─ 0: @openzeppelin/contracts/utils/Counters.sol
   │  │  └─ isUnicode
   │  │     └─ 0: false
   │  ├─ unitAlias
   │  ├─ unitAliasIdentifier
   │  ├─ symbolAliases
   │  └─ symbolAliasesIdentifiers
   └─ 3
      ├─ type: ContractDefinition
      ├─ name: NotaryNFT
      ├─ baseContracts
      │  └─ 0
      │     ├─ type: InheritanceSpecifier
      │     ├─ baseName
      │     │  ├─ type: UserDefinedTypeName
      │     │  └─ namePath: ERC721
      │     └─ arguments
      ├─ subNodes
      │  ├─ 0
      │  │  ├─ type: UsingForDeclaration
      │  │  ├─ isGlobal: false
      │  │  ├─ typeName
      │  │  │  ├─ type: UserDefinedTypeName
      │  │  │  └─ namePath: Counters.Counter
      │  │  ├─ libraryName: Counters
      │  │  └─ functions
      │  ├─ 1
      │  │  ├─ type: StateVariableDeclaration
      │  │  ├─ variables
      │  │  │  └─ 0
      │  │  │     ├─ type: VariableDeclaration
      │  │  │     ├─ typeName
      │  │  │     │  ├─ type: UserDefinedTypeName
      │  │  │     │  └─ namePath: Counters.Counter
      │  │  │     ├─ name: _tokenIdCounter
      │  │  │     ├─ identifier
      │  │  │     │  ├─ type: Identifier
      │  │  │     │  └─ name:_tokenIdCounter
      │  │  │     ├─ expression
      │  │  │     ├─ visibility: private
      │  │  │     ├─ isStateVar: true
      │  │  │     ├─ isDeclaredConst: false
      │  │  │     ├─ isIndexed: false
      │  │  │     ├─ isImmutable: false
      │  │  │     ├─ override
      │  │  │     └─ storageLocation
      │  │  └─ initialValue
      │  ├─ 2
      │  │  ├─ type: StateVariableDeclaration
      │  │  ├─ variables
      │  │  │  └─ 0
      │  │  │     ├─ type: VariableDeclaration
      │  │  │     ├─ typeName
      │  │  │     │  ├─ type: Mapping
      │  │  │     │  ├─ keyType
      │  │  │     │  │  ├─ type: ElementaryTypeName
      │  │  │     │  │  ├─ name: uint256
      │  │  │     │  │  └─ stateMutability
      │  │  │     │  └─ valueType
      │  │  │     │     ├─ type: ElementaryTypeName
      │  │  │     │     ├─ name: string
      │  │  │     │     └─ stateMutability
      │  │  │     ├─ name: tokenURI
      │  │  │     ├─ identifier
      │  │  │     │  ├─ type: Identifier
      │  │  │     │  └─ name: tokenURI
      │  │  │     ├─ expression
      │  │  │     ├─ visibility: public
      │  │  │     ├─ isStateVar: true
      │  │  │     ├─ isDeclaredConst: false
      │  │  │     ├─ isIndexed: false
      │  │  │     ├─ isImmutable: false
      │  │  │     ├─ override
      │  │  │     └─ storageLocation
      │  │  └─ initialValue
      │  ├─ 3
      │  │  ├─ type: EventDefinition
      │  │  ├─ name: NotaryNFTStamped
      │  │  ├─ parameters
      │  │  │  ├─ 0
      │  │  │  │  ├─ type: VariableDeclaration
      │  │  │  │  ├─ typeName
      │  │  │  │  │  ├─ type: ElementaryTypeName
      │  │  │  │  │  ├─ name: uint256
      │  │  │  │  │  └─ stateMutability
      │  │  │  │  ├─ name: tokenId
      │  │  │  │  ├─ identifier
      │  │  │  │  │  ├─ type: Identifier
      │  │  │  │  │  └─ name: tokenId
      │  │  │  │  ├─ isStateVar: false
      │  │  │  │  ├─ isIndexed: true
      │  │  │  │  ├─ storageLocation
      │  │  │  │  └─ expression
      │  │  │  ├─ 1
      │  │  │  │  ├─ type: VariableDeclaration
      │  │  │  │  ├─ typeName
      │  │  │  │  │  ├─ type: ElementaryTypeName
      │  │  │  │  │  ├─ name: address
      │  │  │  │  │  └─ stateMutability
      │  │  │  │  ├─ name: owner
      │  │  │  │  ├─ identifier
      │  │  │  │  │  ├─ type: Identifier
      │  │  │  │  │  └─ name: owner
      │  │  │  │  ├─ isStateVar: false
      │  │  │  │  ├─ isIndexed: true
      │  │  │  │  ├─ storageLocation
      │  │  │  │  └─ expression
      │  │  │  └─ 2
      │  │  │     ├─ type: VariableDeclaration
      │  │  │     ├─ typeName
      │  │  │     │  ├─ type: ElementaryTypeName
      │  │  │     │  ├─ name: bytes32
      │  │  │     │  └─ stateMutability
      │  │  │     ├─ name: documentHash
      │  │  │     ├─ identifier
      │  │  │     │  ├─ type: Identifier
      │  │  │     │  └─ name: documentHash
      │  │  │     ├─ isStateVar: false
      │  │  │     ├─ isIndexed: false
      │  │  │     ├─ storageLocation
      │  │  │     └─ expression
      │  │  └─ isAnonymous: false
      │  ├─ 4
      │  │  ├─ type: FunctionDefinition
      │  │  ├─ name
      │  │  ├─ parameters
      │  │  ├─ returnParameters
      │  │  ├─ body
      │  │  │  ├─ type: Block
      │  │  │  └─ statements
      │  │  ├─ visibility: default
      │  │  ├─ modifiers
      │  │  │  └─ 0
      │  │  │     ├─ type: ModifierInvocation
      │  │  │     ├─ name: ERC721
      │  │  │     └─ arguments
      │  │  │        ├─ 0
      │  │  │        │  ├─ type: StringLiteral
      │  │  │        │  ├─ value: NotaryNFT
      │  │  │        │  ├─ parts
      │  │  │        │  │  └─ 0: NotaryNFT
      │  │  │        │  └─ isUnicode
      │  │  │        │     └─ 0: false
      │  │  │        └─ 1
      │  │  │           ├─ type: StringLiteral
      │  │  │           ├─ value: NOTARY
      │  │  │           ├─ parts
      │  │  │           │  └─ 0: NOTARY
      │  │  │           └─ isUnicode
      │  │  │              └─ 0: false
      │  │  ├─ override
      │  │  ├─ isConstructor: true
      │  │  ├─ isReceiveEther: false
      │  │  ├─ isFallback: false
      │  │  ├─ isVirtual: false
      │  │  └─ stateMutability
      │  ├─ 5
      │  │  ├─ type: FunctionDefinition
      │  │  ├─ name: mintNotaryNFT
      │  │  ├─ parameters
      │  │  │  ├─ 0
      │  │  │  │  ├─ type: VariableDeclaration
      │  │  │  │  ├─ typeName
      │  │  │  │  │  ├─ type: ElementaryTypeName
      │  │  │  │  │  ├─ name: address
      │  │  │  │  │  └─ stateMutability
      │  │  │  │  ├─ name: to
      │  │  │  │  ├─ identifier
      │  │  │  │  │  ├─ type: Identifier
      │  │  │  │  │  └─ name: to
      │  │  │  │  ├─ storageLocation
      │  │  │  │  ├─ isStateVar: false
      │  │  │  │  ├─ isIndexed: false
      │  │  │  │  └─ expression
      │  │  │  └─ 1
      │  │  │     ├─ type: VariableDeclaration
      │  │  │     ├─ typeName
      │  │  │     │  ├─ type: ElementaryTypeName
      │  │  │     │  ├─ name: bytes32
      │  │  │     │  └─ stateMutability
      │  │  │     ├─ name: documentHash
      │  │  │     ├─ identifier
      │  │  │     │  ├─ type: Identifier
      │  │  │     │  └─ name: documentHash
      │  │  │     ├─ storageLocation
      │  │  │     ├─ isStateVar: false
      │  │  │     ├─ isIndexed: false
      │  │  │     └─ expression
      │  │  ├─ returnParameters
      │  │  │  └─ 0
      │  │  │     ├─ type: VariableDeclaration
      │  │  │     ├─ typeName
      │  │  │     │  ├─ type: ElementaryTypeName
      │  │  │     │  ├─ name: uint256
      │  │  │     │  └─ stateMutability
      │  │  │     ├─ name
      │  │  │     ├─ identifier
      │  │  │     ├─ storageLocation
      │  │  │     ├─ isStateVar: false
      │  │  │     ├─ isIndexed: false
      │  │  │     └─ expression
      │  │  ├─ body
      │  │  │  ├─ type: Block
      │  │  │  └─ statements
      │  │  │     ├─ 0
      │  │  │     │  ├─ type: VariableDeclarationStatement
      │  │  │     │  ├─ variables
      │  │  │     │  │  └─ 0
      │  │  │     │  │     ├─ type: VariableDeclaration
      │  │  │     │  │     ├─ typeName
      │  │  │     │  │     │  ├─ type: ElementaryTypeName
      │  │  │     │  │     │  ├─ name: uint256
      │  │  │     │  │     │  └─ stateMutability
      │  │  │     │  │     ├─ name: tokenId
      │  │  │     │  │     ├─ identifier
      │  │  │     │  │     │  ├─ type: Identifier
      │  │  │     │  │     │  └─ name: tokenId
      │  │  │     │  │     ├─ storageLocation
      │  │  │     │  │     ├─ isStateVar: false
      │  │  │     │  │     ├─ isIndexed: false
      │  │  │     │  │     └─ expression
      │  │  │     │  └─ initialValue
      │  │  │     │     ├─ type: FunctionCall
      │  │  │     │     ├─ expression
      │  │  │     │     │  ├─ type: MemberAccess
      │  │  │     │     │  ├─ expression
      │  │  │     │     │  │  ├─ type: Identifier
      │  │  │     │     │  │  └─ name: _tokenIdCounter
      │  │  │     │     │  └─ memberName: current
      │  │  │     │     ├─ arguments
      │  │  │     │     ├─ names
      │  │  │     │     └─ identifiers
      │  │  │     ├─ 1
      │  │  │     │  ├─ type: ExpressionStatement
      │  │  │     │  └─ expression
      │  │  │     │     ├─ type: FunctionCall
      │  │  │     │     ├─ expression
      │  │  │     │     │  ├─ type: MemberAccess
      │  │  │     │     │  ├─ expression
      │  │  │     │     │  │  ├─ type: Identifier
      │  │  │     │     │  │  └─ name:_tokenIdCounter
      │  │  │     │     │  └─ memberName: increment
      │  │  │     │     ├─ arguments
      │  │  │     │     ├─ names
      │  │  │     │     └─ identifiers
      │  │  │     ├─ 2
      │  │  │     │  ├─ type: ExpressionStatement
      │  │  │     │  └─ expression
      │  │  │     │     ├─ type: FunctionCall
      │  │  │     │     ├─ expression
      │  │  │     │     │  ├─ type: Identifier
      │  │  │     │     │  └─ name: _safeMint
      │  │  │     │     ├─ arguments
      │  │  │     │     │  ├─ 0
      │  │  │     │     │  │  ├─ type: Identifier
      │  │  │     │     │  │  └─ name: to
      │  │  │     │     │  └─ 1
      │  │  │     │     │     ├─ type: Identifier
      │  │  │     │     │     └─ name: tokenId
      │  │  │     │     ├─ names
      │  │  │     │     └─ identifiers
      │  │  │     ├─ 3
      │  │  │     │  ├─ type: VariableDeclarationStatement
      │  │  │     │  ├─ variables
      │  │  │     │  │  └─ 0
      │  │  │     │  │     ├─ type: VariableDeclaration
      │  │  │     │  │     ├─ typeName
      │  │  │     │  │     │  ├─ type: ElementaryTypeName
      │  │  │     │  │     │  ├─ name: string
      │  │  │     │  │     │  └─ stateMutability
      │  │  │     │  │     ├─ name: uri
      │  │  │     │  │     ├─ identifier
      │  │  │     │  │     │  ├─ type: Identifier
      │  │  │     │  │     │  └─ name: uri
      │  │  │     │  │     ├─ storageLocation: memory
      │  │  │     │  │     ├─ isStateVar: false
      │  │  │     │  │     ├─ isIndexed: false
      │  │  │     │  │     └─ expression
      │  │  │     │  └─ initialValue
      │  │  │     │     ├─ type: FunctionCall
      │  │  │     │     ├─ expression
      │  │  │     │     │  ├─ type: ElementaryTypeName
      │  │  │     │     │  ├─ name: string
      │  │  │     │     │  └─ stateMutability
      │  │  │     │     ├─ arguments
      │  │  │     │     │  └─ 0
      │  │  │     │     │     ├─ type: FunctionCall
      │  │  │     │     │     ├─ expression
      │  │  │     │     │     │  ├─ type: MemberAccess
      │  │  │     │     │     │  ├─ expression
      │  │  │     │     │     │  │  ├─ type: Identifier
      │  │  │     │     │     │  │  └─ name: abi
      │  │  │     │     │     │  └─ memberName: encodePacked
      │  │  │     │     │     ├─ arguments
      │  │  │     │     │     │  ├─ 0
      │  │  │     │     │     │  │  ├─ type: StringLiteral
      │  │  │     │     │     │  │  ├─ value: ipfs://
      │  │  │     │     │     │  │  ├─ parts
      │  │  │     │     │     │  │  │  └─ 0: ipfs://
      │  │  │     │     │     │  │  └─ isUnicode
      │  │  │     │     │     │  │     └─ 0: false
      │  │  │     │     │     │  └─ 1
      │  │  │     │     │     │     ├─ type: Identifier
      │  │  │     │     │     │     └─ name: documentHash
      │  │  │     │     │     ├─ names
      │  │  │     │     │     └─ identifiers
      │  │  │     │     ├─ names
      │  │  │     │     └─ identifiers
      │  │  │     ├─ 4
      │  │  │     │  ├─ type: ExpressionStatement
      │  │  │     │  └─ expression
      │  │  │     │     ├─ type: BinaryOperation
      │  │  │     │     ├─ operator: =
      │  │  │     │     ├─ left
      │  │  │     │     │  ├─ type: IndexAccess
      │  │  │     │     │  ├─ base
      │  │  │     │     │  │  ├─ type: Identifier
      │  │  │     │     │  │  └─ name: tokenURI
      │  │  │     │     │  └─ index
      │  │  │     │     │     ├─ type: Identifier
      │  │  │     │     │     └─ name: tokenId
      │  │  │     │     └─ right
      │  │  │     │        ├─ type: Identifier
      │  │  │     │        └─ name: uri
      │  │  │     ├─ 5
      │  │  │     │  ├─ type: EmitStatement
      │  │  │     │  └─ eventCall
      │  │  │     │     ├─ type: FunctionCall
      │  │  │     │     ├─ expression
      │  │  │     │     │  ├─ type: Identifier
      │  │  │     │     │  └─ name: NotaryNFTStamped
      │  │  │     │     ├─ arguments
      │  │  │     │     │  ├─ 0
      │  │  │     │     │  │  ├─ type: Identifier
      │  │  │     │     │  │  └─ name: tokenId
      │  │  │     │     │  ├─ 1
      │  │  │     │     │  │  ├─ type: Identifier
      │  │  │     │     │  │  └─ name: to
      │  │  │     │     │  └─ 2
      │  │  │     │     │     ├─ type: Identifier
      │  │  │     │     │     └─ name: documentHash
      │  │  │     │     ├─ names
      │  │  │     │     └─ identifiers
      │  │  │     └─ 6
      │  │  │        ├─ type: ReturnStatement
      │  │  │        └─ expression
      │  │  │           ├─ type: Identifier
      │  │  │           └─ name: tokenId
      │  │  ├─ visibility: public
      │  │  ├─ modifiers
      │  │  ├─ override
      │  │  ├─ isConstructor: false
      │  │  ├─ isReceiveEther: false
      │  │  ├─ isFallback: false
      │  │  ├─ isVirtual: false
      │  │  └─ stateMutability
      │  ├─ 6
      │  │  ├─ type: FunctionDefinition
      │  │  ├─ name: updateMetadata
      │  │  ├─ parameters
      │  │  │  ├─ 0
      │  │  │  │  ├─ type: VariableDeclaration
      │  │  │  │  ├─ typeName
      │  │  │  │  │  ├─ type: ElementaryTypeName
      │  │  │  │  │  ├─ name: uint256
      │  │  │  │  │  └─ stateMutability
      │  │  │  │  ├─ name: tokenId
      │  │  │  │  ├─ identifier
      │  │  │  │  │  ├─ type: Identifier
      │  │  │  │  │  └─ name: tokenId
      │  │  │  │  ├─ storageLocation
      │  │  │  │  ├─ isStateVar: false
      │  │  │  │  ├─ isIndexed: false
      │  │  │  │  └─ expression
      │  │  │  └─ 1
      │  │  │     ├─ type: VariableDeclaration
      │  │  │     ├─ typeName
      │  │  │     │  ├─ type: ElementaryTypeName
      │  │  │     │  ├─ name: string
      │  │  │     │  └─ stateMutability
      │  │  │     ├─ name: newURI
      │  │  │     ├─ identifier
      │  │  │     │  ├─ type: Identifier
      │  │  │     │  └─ name: newURI
      │  │  │     ├─ storageLocation: calldata
      │  │  │     ├─ isStateVar: false
      │  │  │     ├─ isIndexed: false
      │  │  │     └─ expression
      │  │  ├─ returnParameters
      │  │  ├─ body
      │  │  │  ├─ type: Block
      │  │  │  └─ statements
      │  │  │     ├─ 0
      │  │  │     │  ├─ type: ExpressionStatement
      │  │  │     │  └─ expression
      │  │  │     │     ├─ type: FunctionCall
      │  │  │     │     ├─ expression
      │  │  │     │     │  ├─ type: Identifier
      │  │  │     │     │  └─ name: require
      │  │  │     │     ├─ arguments
      │  │  │     │     │  ├─ 0
      │  │  │     │     │  │  ├─ type: FunctionCall
      │  │  │     │     │  │  ├─ expression
      │  │  │     │     │  │  │  ├─ type: Identifier
      │  │  │     │     │  │  │  └─ name:_exists
      │  │  │     │     │  │  ├─ arguments
      │  │  │     │     │  │  │  └─ 0
      │  │  │     │     │  │  │     ├─ type: Identifier
      │  │  │     │     │  │  │     └─ name: tokenId
      │  │  │     │     │  │  ├─ names
      │  │  │     │     │  │  └─ identifiers
      │  │  │     │     │  └─ 1
      │  │  │     │     │     ├─ type: StringLiteral
      │  │  │     │     │     ├─ value: ERC721Metadata: URI query for nonexistent token
      │  │  │     │     │     ├─ parts
      │  │  │     │     │     │  └─ 0: ERC721Metadata: URI query for nonexistent token
      │  │  │     │     │     └─ isUnicode
      │  │  │     │     │        └─ 0: false
      │  │  │     │     ├─ names
      │  │  │     │     └─ identifiers
      │  │  │     └─ 1
      │  │  │        ├─ type: ExpressionStatement
      │  │  │        └─ expression
      │  │  │           ├─ type: BinaryOperation
      │  │  │           ├─ operator: =
      │  │  │           ├─ left
      │  │  │           │  ├─ type: IndexAccess
      │  │  │           │  ├─ base
      │  │  │           │  │  ├─ type: Identifier
      │  │  │           │  │  └─ name: tokenURI
      │  │  │           │  └─ index
      │  │  │           │     ├─ type: Identifier
      │  │  │           │     └─ name: tokenId
      │  │  │           └─ right
      │  │  │              ├─ type: Identifier
      │  │  │              └─ name: newURI
      │  │  ├─ visibility: public
      │  │  ├─ modifiers
      │  │  ├─ override
      │  │  ├─ isConstructor: false
      │  │  ├─ isReceiveEther: false
      │  │  ├─ isFallback: false
      │  │  ├─ isVirtual: false
      │  │  └─ stateMutability
      │  └─ 7
      │     ├─ type: FunctionDefinition
      │     ├─ name: transferOwnership
      │     ├─ parameters
      │     │  ├─ 0
      │     │  │  ├─ type: VariableDeclaration
      │     │  │  ├─ typeName
      │     │  │  │  ├─ type: ElementaryTypeName
      │     │  │  │  ├─ name: address
      │     │  │  │  └─ stateMutability
      │     │  │  ├─ name: from
      │     │  │  ├─ identifier
      │     │  │  │  ├─ type: Identifier
      │     │  │  │  └─ name: from
      │     │  │  ├─ storageLocation
      │     │  │  ├─ isStateVar: false
      │     │  │  ├─ isIndexed: false
      │     │  │  └─ expression
      │     │  ├─ 1
      │     │  │  ├─ type: VariableDeclaration
      │     │  │  ├─ typeName
      │     │  │  │  ├─ type: ElementaryTypeName
      │     │  │  │  ├─ name: address
      │     │  │  │  └─ stateMutability
      │     │  │  ├─ name: to
      │     │  │  ├─ identifier
      │     │  │  │  ├─ type: Identifier
      │     │  │  │  └─ name: to
      │     │  │  ├─ storageLocation
      │     │  │  ├─ isStateVar: false
      │     │  │  ├─ isIndexed: false
      │     │  │  └─ expression
      │     │  └─ 2
      │     │     ├─ type: VariableDeclaration
      │     │     ├─ typeName
      │     │     │  ├─ type: ElementaryTypeName
      │     │     │  ├─ name: uint256
      │     │     │  └─ stateMutability
      │     │     ├─ name: tokenId
      │     │     ├─ identifier
      │     │     │  ├─ type: Identifier
      │     │     │  └─ name: tokenId
      │     │     ├─ storageLocation
      │     │     ├─ isStateVar: false
      │     │     ├─ isIndexed: false
      │     │     └─ expression
      │     ├─ returnParameters
      │     ├─ body
      │     │  ├─ type: Block
      │     │  └─ statements
      │     │     ├─ 0
      │     │     │  ├─ type: ExpressionStatement
      │     │     │  └─ expression
      │     │     │     ├─ type: FunctionCall
      │     │     │     ├─ expression
      │     │     │     │  ├─ type: Identifier
      │     │     │     │  └─ name: require
      │     │     │     ├─ arguments
      │     │     │     │  ├─ 0
      │     │     │     │  │  ├─ type: FunctionCall
      │     │     │     │  │  ├─ expression
      │     │     │     │  │  │  ├─ type: Identifier
      │     │     │     │  │  │  └─ name: _isApprovedOrOwner
      │     │     │     │  │  ├─ arguments
      │     │     │     │  │  │  ├─ 0
      │     │     │     │  │  │  │  ├─ type: FunctionCall
      │     │     │     │  │  │  │  ├─ expression
      │     │     │     │  │  │  │  │  ├─ type: Identifier
      │     │     │     │  │  │  │  │  └─ name:_msgSender
      │     │     │     │  │  │  │  ├─ arguments
      │     │     │     │  │  │  │  ├─ names
      │     │     │     │  │  │  │  └─ identifiers
      │     │     │     │  │  │  └─ 1
      │     │     │     │  │  │     ├─ type: Identifier
      │     │     │     │  │  │     └─ name: tokenId
      │     │     │     │  │  ├─ names
      │     │     │     │  │  └─ identifiers
      │     │     │     │  └─ 1
      │     │     │     │     ├─ type: StringLiteral
      │     │     │     │     ├─ value: ERC721: transfer caller is not owner nor approved
      │     │     │     │     ├─ parts
      │     │     │     │     │  └─ 0: ERC721: transfer caller is not owner nor approved
      │     │     │     │     └─ isUnicode
      │     │     │     │        └─ 0: false
      │     │     │     ├─ names
      │     │     │     └─ identifiers
      │     │     └─ 1
      │     │        ├─ type: ExpressionStatement
      │     │        └─ expression
      │     │           ├─ type: FunctionCall
      │     │           ├─ expression
      │     │           │  ├─ type: Identifier
      │     │           │  └─ name: _transfer
      │     │           ├─ arguments
      │     │           │  ├─ 0
      │     │           │  │  ├─ type: Identifier
      │     │           │  │  └─ name: from
      │     │           │  ├─ 1
      │     │           │  │  ├─ type: Identifier
      │     │           │  │  └─ name: to
      │     │           │  └─ 2
      │     │           │     ├─ type: Identifier
      │     │           │     └─ name: tokenId
      │     │           ├─ names
      │     │           └─ identifiers
      │     ├─ visibility: public
      │     ├─ modifiers
      │     ├─ override
      │     ├─ isConstructor: false
      │     ├─ isReceiveEther: false
      │     ├─ isFallback: false
      │     ├─ isVirtual: false
      │     └─ stateMutability
      └─ kind: contract
