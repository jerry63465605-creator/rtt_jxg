/* 由 prelude_compiler.renderSpecs 生成；DIY 只新增，不改 cards.js */
/* P2 派发器按 carrier 查下列四张同构独立表；既有四张效果表不受影响 */
module.exports = {
  PRELUDE_SPECS: [
  {
    "id": 90001,
    "nation": "德国",
    "deck": "PRELUDE",
    "type": "PRELUDE",
    "name": "DIY 试作·东线调动",
    "text": "[紧张度+1]。在<乌克兰>征召陆军",
    "img": "diy_90001.png",
    "carrier": "event",
    "owner": "admin",
    "visibility": "private"
  },
  {
    "id": 90002,
    "nation": "英国",
    "deck": "ARMAMENT",
    "type": "ARMAMENT",
    "name": "DIY 试作·应急造舰",
    "text": "出牌阶段开始时。建设1支海军",
    "img": "diy_90002.png",
    "carrier": "response",
    "owner": "admin",
    "visibility": "private"
  },
  {
    "id": 90003,
    "nation": "日本",
    "deck": "PRELUDE",
    "type": "PRELUDE",
    "name": "DIY 试作·北方施压",
    "text": "苏联损耗1张前奏牌",
    "img": "diy_90003.png",
    "carrier": "econ",
    "owner": "admin",
    "visibility": "private"
  },
  {
    "id": 90004,
    "nation": "美国",
    "deck": "PRELUDE",
    "type": "PRELUDE",
    "name": "DIY 试作·长期动员",
    "text": "[持续]。获得2分",
    "img": "diy_90004.png",
    "carrier": "status",
    "owner": "admin",
    "visibility": "private"
  }
],
  PRELUDE_EVENT_EFFECTS: {
  "90001": {
    "cost": {
      "tension": 1,
      "score": 0,
      "discard": []
    },
    "steps": [
      {
        "op": "recruit",
        "space": "乌克兰",
        "adjacent": false,
        "n": 1,
        "type": "陆军"
      }
    ],
    "choice": null,
    "guards": [],
    "tags": [],
    "refs": [],
    "triggers": [],
    "segments": [
      {
        "index": 0,
        "kind": "mandatory",
        "seg": 0,
        "headTokens": [
          "[紧张度+1]"
        ],
        "cost": {
          "tension": 1,
          "score": 0,
          "discard": []
        },
        "steps": [
          {
            "op": "recruit",
            "space": "乌克兰",
            "adjacent": false,
            "n": 1,
            "type": "陆军"
          }
        ],
        "guards": [],
        "tags": [],
        "triggers": [],
        "refs": [],
        "filters": [],
        "effectMode": "once"
      }
    ],
    "mandatory": {
      "index": 0,
      "kind": "mandatory",
      "seg": 0,
      "headTokens": [
        "[紧张度+1]"
      ],
      "cost": {
        "tension": 1,
        "score": 0,
        "discard": []
      },
      "steps": [
        {
          "op": "recruit",
          "space": "乌克兰",
          "adjacent": false,
          "n": 1,
          "type": "陆军"
        }
      ],
      "guards": [],
      "tags": [],
      "triggers": [],
      "refs": [],
      "filters": [],
      "effectMode": "once"
    },
    "optional": [],
    "opponentOptOut": []
  }
},
  PRELUDE_RESPONSE_EFFECTS: {
  "90002": {
    "trigger": {
      "on": "play_start",
      "filter": []
    },
    "effect": {
      "ops": [
        {
          "op": "build",
          "space": null,
          "adjacent": false,
          "n": 1,
          "type": "海军"
        }
      ],
      "guards": [],
      "refs": []
    },
    "segments": [
      {
        "index": 0,
        "kind": "mandatory",
        "seg": 0,
        "headTokens": [],
        "cost": {
          "tension": 0,
          "score": 0,
          "discard": []
        },
        "steps": [
          {
            "op": "build",
            "space": null,
            "adjacent": false,
            "n": 1,
            "type": "海军"
          }
        ],
        "guards": [],
        "tags": [],
        "triggers": [
          {
            "on": "play_start"
          }
        ],
        "refs": [],
        "filters": [],
        "effectMode": "once"
      }
    ],
    "mandatory": {
      "index": 0,
      "kind": "mandatory",
      "seg": 0,
      "headTokens": [],
      "cost": {
        "tension": 0,
        "score": 0,
        "discard": []
      },
      "steps": [
        {
          "op": "build",
          "space": null,
          "adjacent": false,
          "n": 1,
          "type": "海军"
        }
      ],
      "guards": [],
      "tags": [],
      "triggers": [
        {
          "on": "play_start"
        }
      ],
      "refs": [],
      "filters": [],
      "effectMode": "once"
    },
    "optional": [],
    "opponentOptOut": []
  }
},
  PRELUDE_ECON_EFFECTS: {
  "90003": {
    "tag": "前奏",
    "targets": [
      "苏联"
    ],
    "chain": [
      {
        "op": "attrition_prelude",
        "target": "苏联",
        "n": 1
      }
    ],
    "run": {
      "ops": [
        {
          "op": "attrition_prelude",
          "target": "苏联",
          "n": 1
        }
      ],
      "guards": []
    },
    "segments": [
      {
        "index": 0,
        "kind": "mandatory",
        "seg": 0,
        "headTokens": [],
        "cost": {
          "tension": 0,
          "score": 0,
          "discard": []
        },
        "steps": [
          {
            "op": "attrition_prelude",
            "target": "苏联",
            "n": 1
          }
        ],
        "guards": [],
        "tags": [],
        "triggers": [],
        "refs": [],
        "filters": [],
        "effectMode": "once"
      }
    ],
    "mandatory": {
      "index": 0,
      "kind": "mandatory",
      "seg": 0,
      "headTokens": [],
      "cost": {
        "tension": 0,
        "score": 0,
        "discard": []
      },
      "steps": [
        {
          "op": "attrition_prelude",
          "target": "苏联",
          "n": 1
        }
      ],
      "guards": [],
      "tags": [],
      "triggers": [],
      "refs": [],
      "filters": [],
      "effectMode": "once"
    },
    "optional": [],
    "opponentOptOut": []
  }
},
  PRELUDE_STATUS_EFFECTS: {
  "90004": {
    "trigger": {
      "window": "play_start",
      "cost": {
        "tension": 0,
        "score": 0,
        "discard": []
      },
      "effect": {
        "ops": [
          {
            "op": "gain_score",
            "nation": null,
            "n": 2
          }
        ]
      }
    },
    "once_per_turn": true,
    "bookkeeping": "status_used",
    "ready": {
      "guards": [],
      "filters": []
    },
    "ongoing": {
      "tags": [
        "persistent"
      ],
      "refs": [],
      "segments": [
        {
          "index": 0,
          "tags": [
            "persistent"
          ],
          "steps": [
            {
              "op": "gain_score",
              "nation": null,
              "n": 2
            }
          ]
        }
      ]
    },
    "segments": [
      {
        "index": 0,
        "kind": "mandatory",
        "seg": 0,
        "headTokens": [
          "[持续]"
        ],
        "cost": {
          "tension": 0,
          "score": 0,
          "discard": []
        },
        "steps": [
          {
            "op": "gain_score",
            "nation": null,
            "n": 2
          }
        ],
        "guards": [],
        "tags": [
          "persistent"
        ],
        "triggers": [],
        "refs": [],
        "filters": [],
        "effectMode": "ongoing"
      }
    ],
    "mandatory": {
      "index": 0,
      "kind": "mandatory",
      "seg": 0,
      "headTokens": [
        "[持续]"
      ],
      "cost": {
        "tension": 0,
        "score": 0,
        "discard": []
      },
      "steps": [
        {
          "op": "gain_score",
          "nation": null,
          "n": 2
        }
      ],
      "guards": [],
      "tags": [
        "persistent"
      ],
      "triggers": [],
      "refs": [],
      "filters": [],
      "effectMode": "ongoing"
    },
    "optional": [],
    "opponentOptOut": [],
    "auto": [
      {
        "phase": "play_start",
        "seg": 0,
        "kind": "run",
        "steps": [
          {
            "op": "gain_score",
            "nation": null,
            "n": 2
          }
        ]
      }
    ]
  }
},
};
