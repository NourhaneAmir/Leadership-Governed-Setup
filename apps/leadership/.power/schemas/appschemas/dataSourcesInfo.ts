/*!
 * Copyright (C) Microsoft Corporation. All rights reserved.
 * This file is auto-generated. Do not modify it manually.
 * Changes to this file may be overwritten.
 */

export const dataSourcesInfo = {
  "stf_kpiachievmentbreakdowns": {
    "tableId": "stf_kpiachievmentbreakdowns",
    "version": "",
    "primaryKey": "stf_kpiachievmentbreakdownid",
    "dataSourceType": "Connector",
    "apis": {}
  },
  "pm_kpiachievments": {
    "tableId": "pm_kpiachievments",
    "version": "",
    "primaryKey": "pm_kpiachievmentid",
    "dataSourceType": "Connector",
    "apis": {}
  },
  "lm_meetingoccurrencelinkedreportses": {
    "tableId": "lm_meetingoccurrencelinkedreportses",
    "version": "",
    "primaryKey": "lm_meetingoccurrencelinkedreportsid",
    "dataSourceType": "Connector",
    "apis": {}
  },
  "lm_reportoccurrencedepartmentfunctions": {
    "tableId": "lm_reportoccurrencedepartmentfunctions",
    "version": "",
    "primaryKey": "lm_reportoccurrencedepartmentfunctionid",
    "dataSourceType": "Connector",
    "apis": {}
  },
  "wlog_decisions": {
    "tableId": "wlog_decisions",
    "version": "",
    "primaryKey": "wlog_decisionid",
    "dataSourceType": "Connector",
    "apis": {}
  },
  "commondataserviceforapps": {
    "tableId": "",
    "version": "",
    "primaryKey": "",
    "dataSourceType": "Connector",
    "apis": {
      "GetOrganizations": {
        "path": "/{connectionId}/v1.0/$metadata.json/organizations",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetOrganizationsTest": {
        "path": "/{connectionId}/v1.0/$metadata.json/organizationsTest",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetMetadataForGetEntity": {
        "path": "/{connectionId}/$metadata.json/entities/{entityName}",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "selectedEntityAttributes",
            "in": "query",
            "required": false,
            "type": "string"
          },
          {
            "name": "expandEntityAttributes",
            "in": "query",
            "required": false,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetMetadataForGetEntityWithOrganization": {
        "path": "/{connectionId}/v1.0/$metadata.json/entities/{entityName}",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "organization",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "selectedEntityAttributes",
            "in": "query",
            "required": false,
            "type": "string"
          },
          {
            "name": "expandEntityAttributes",
            "in": "query",
            "required": false,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetMetadataForGetEntityCUDTrigger": {
        "path": "/{connectionId}/$metadata.json/entities/{entityName}/cudtrigger",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetMetadataForGetEntityCUDTriggerWithOrganization": {
        "path": "/{connectionId}/v1.0/$metadata.json/entities/{entityName}/cudtrigger",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "organization",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetActivityPartyAttributes": {
        "path": "/{connectionId}/$metadata.json/entities/{entityName}/activityparties",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetActivityPartyAttributesWithOrganization": {
        "path": "/{connectionId}/v1.0/$metadata.json/GetEntityListEnum/GetActivityPartyAttributesWithOrganization",
        "method": "POST",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "organization",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "body",
            "in": "body",
            "required": true,
            "type": "object"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetMetadataForPostEntity": {
        "path": "/{connectionId}/$metadata.json/entities/{entityName}/postitem",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetMetadataForPostEntityWithOrganization": {
        "path": "/{connectionId}/v1.0/$metadata.json/entities/{entityName}/postitem",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "organization",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetMetadataForPatchEntity": {
        "path": "/{connectionId}/$metadata.json/entities/{entityName}/patchitem",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetMetadataForPatchEntityWithOrganization": {
        "path": "/{connectionId}/v1.0/$metadata.json/entities/{entityName}/patchitem",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "organization",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetEntityRelationships": {
        "path": "/{connectionId}/$metadata.json/entities/{entityName}/relationships",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetEntityRelationshipsWithOrganization": {
        "path": "/{connectionId}/v1.0/$metadata.json/GetEntityListEnum/GetEntityRelationshipsWithOrganization",
        "method": "POST",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "organization",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "body",
            "in": "body",
            "required": true,
            "type": "object"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetAttributeFilters": {
        "path": "/{connectionId}/entities/{entityName}/attributefilters",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "attributeTypeNames",
            "in": "header",
            "required": false,
            "type": "array"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "array"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetAttributeFiltersWithOrganization": {
        "path": "/{connectionId}/v1.0/$metadata.json/GetEntityListEnum/GetAttributeFiltersWithOrganization",
        "method": "POST",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "organization",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "body",
            "in": "body",
            "required": true,
            "type": "object"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetScopeFilters": {
        "path": "/{connectionId}/entities/{entityName}/scopefilters",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "array"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetScopeFiltersWithOrganization": {
        "path": "/{connectionId}/v1.0/$metadata.json/GetEntityListEnum/GetScopeFiltersWithOrganization",
        "method": "POST",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "organization",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "body",
            "in": "body",
            "required": true,
            "type": "object"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetOptionSetMetadata": {
        "path": "/{connectionId}/entities/{entityName}/attributes/{attributeMetadataId}/optionSets/{type}",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "attributeMetadataId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "type",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetOptionSetMetadataWithOrganization": {
        "path": "/{connectionId}/v1.0/$metadata.json/GetEntityListEnum/GetOptionSetMetadataWithOrganization",
        "method": "POST",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "organization",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "body",
            "in": "body",
            "required": true,
            "type": "object"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetOptionSetMetadataWithEntitySetName": {
        "path": "/{connectionId}/entities/{entityName}/attributes/{attributeMetadataId}/optionSets/{type}/entitysetname",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "attributeMetadataId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "type",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetOptionSetMetadataWithEntitySetNameWithOrganization": {
        "path": "/{connectionId}/v1.0/$metadata.json/GetEntityListEnum/GetOptionSetMetadataWithEntitySetNameWithOrganization",
        "method": "POST",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "organization",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "body",
            "in": "body",
            "required": true,
            "type": "object"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetEntities": {
        "path": "/{connectionId}/api/data/v9.1/EntityDefinitions",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetEntitiesWithOrganization": {
        "path": "/{connectionId}/v1.0/$metadata.json/GetEntityListEnum/GetEntitiesWithOrganization",
        "method": "POST",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "organization",
            "in": "header",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "SubscribeWebhookTrigger": {
        "path": "/{connectionId}/api/data/v9.1/callbackregistrations",
        "method": "POST",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "Consistency",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "subscriptionRequest",
            "in": "body",
            "required": true,
            "type": "object"
          },
          {
            "name": "catalog",
            "in": "header",
            "required": false,
            "type": "string"
          },
          {
            "name": "category",
            "in": "header",
            "required": false,
            "type": "string"
          }
        ],
        "responseInfo": {
          "204": {
            "type": "void"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "SubscribeWebhookTriggerWithOrganization": {
        "path": "/{connectionId}/api/data/v9.1.0/callbackregistrations",
        "method": "POST",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "organization",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "Consistency",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "subscriptionRequest",
            "in": "body",
            "required": true,
            "type": "object"
          },
          {
            "name": "catalog",
            "in": "header",
            "required": false,
            "type": "string"
          },
          {
            "name": "category",
            "in": "header",
            "required": false,
            "type": "string"
          }
        ],
        "responseInfo": {
          "204": {
            "type": "void"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "ListRecords": {
        "path": "/{connectionId}/api/data/v9.1/{entityName}",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "prefer",
            "in": "header",
            "required": false,
            "type": "string"
          },
          {
            "name": "accept",
            "in": "header",
            "required": false,
            "type": "string"
          },
          {
            "name": "x-ms-odata-metadata-full",
            "in": "header",
            "required": false,
            "type": "boolean"
          },
          {
            "name": "$select",
            "in": "query",
            "required": false,
            "type": "string"
          },
          {
            "name": "$filter",
            "in": "query",
            "required": false,
            "type": "string"
          },
          {
            "name": "$orderby",
            "in": "query",
            "required": false,
            "type": "string"
          },
          {
            "name": "$expand",
            "in": "query",
            "required": false,
            "type": "string"
          },
          {
            "name": "fetchXml",
            "in": "query",
            "required": false,
            "type": "string"
          },
          {
            "name": "$top",
            "in": "query",
            "required": false,
            "type": "integer"
          },
          {
            "name": "$skiptoken",
            "in": "query",
            "required": false,
            "type": "string"
          },
          {
            "name": "partitionId",
            "in": "query",
            "required": false,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "CreateRecord": {
        "path": "/{connectionId}/api/data/v9.1/{entityName}",
        "method": "POST",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "prefer",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "accept",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "item",
            "in": "body",
            "required": true,
            "type": "object"
          },
          {
            "name": "x-ms-odata-metadata-full",
            "in": "header",
            "required": false,
            "type": "boolean"
          }
        ],
        "responseInfo": {
          "201": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "ListRecordsWithOrganization": {
        "path": "/{connectionId}/api/data/v9.1.0/{entityName}",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "organization",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "prefer",
            "in": "header",
            "required": false,
            "type": "string"
          },
          {
            "name": "accept",
            "in": "header",
            "required": false,
            "type": "string"
          },
          {
            "name": "x-ms-odata-metadata-full",
            "in": "header",
            "required": false,
            "type": "boolean"
          },
          {
            "name": "MSCRM.IncludeMipSensitivityLabel",
            "in": "header",
            "required": false,
            "type": "boolean"
          },
          {
            "name": "$select",
            "in": "query",
            "required": false,
            "type": "string"
          },
          {
            "name": "$filter",
            "in": "query",
            "required": false,
            "type": "string"
          },
          {
            "name": "$orderby",
            "in": "query",
            "required": false,
            "type": "string"
          },
          {
            "name": "$expand",
            "in": "query",
            "required": false,
            "type": "string"
          },
          {
            "name": "fetchXml",
            "in": "query",
            "required": false,
            "type": "string"
          },
          {
            "name": "$top",
            "in": "query",
            "required": false,
            "type": "integer"
          },
          {
            "name": "$skiptoken",
            "in": "query",
            "required": false,
            "type": "string"
          },
          {
            "name": "partitionId",
            "in": "query",
            "required": false,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "CreateRecordWithOrganization": {
        "path": "/{connectionId}/api/data/v9.1.0/{entityName}",
        "method": "POST",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "prefer",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "accept",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "organization",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "item",
            "in": "body",
            "required": true,
            "type": "object"
          },
          {
            "name": "x-ms-odata-metadata-full",
            "in": "header",
            "required": false,
            "type": "boolean"
          }
        ],
        "responseInfo": {
          "201": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetItem": {
        "path": "/{connectionId}/api/data/v9.1/{entityName}({recordId})",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "prefer",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "accept",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "recordId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "x-ms-odata-metadata-full",
            "in": "header",
            "required": false,
            "type": "boolean"
          },
          {
            "name": "$select",
            "in": "query",
            "required": false,
            "type": "string"
          },
          {
            "name": "$expand",
            "in": "query",
            "required": false,
            "type": "string"
          },
          {
            "name": "partitionId",
            "in": "query",
            "required": false,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "DeleteRecord": {
        "path": "/{connectionId}/api/data/v9.1/{entityName}({recordId})",
        "method": "DELETE",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "recordId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "partitionId",
            "in": "query",
            "required": false,
            "type": "string"
          }
        ],
        "responseInfo": {
          "204": {
            "type": "void"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "UpdateRecord": {
        "path": "/{connectionId}/api/data/v9.1/{entityName}({recordId})",
        "method": "PATCH",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "prefer",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "accept",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "recordId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "item",
            "in": "body",
            "required": true,
            "type": "object"
          },
          {
            "name": "x-ms-odata-metadata-full",
            "in": "header",
            "required": false,
            "type": "boolean"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "UpdateOnlyRecord": {
        "path": "/{connectionId}/api/data/v9.2/{entityName}({recordId})",
        "method": "PATCH",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "prefer",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "accept",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "If-Match",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "recordId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "item",
            "in": "body",
            "required": true,
            "type": "object"
          },
          {
            "name": "x-ms-odata-metadata-full",
            "in": "header",
            "required": false,
            "type": "boolean"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetItemWithOrganization": {
        "path": "/{connectionId}/api/data/v9.1.0/{entityName}({recordId})",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "prefer",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "accept",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "organization",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "recordId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "x-ms-odata-metadata-full",
            "in": "header",
            "required": false,
            "type": "boolean"
          },
          {
            "name": "MSCRM.IncludeMipSensitivityLabel",
            "in": "header",
            "required": false,
            "type": "boolean"
          },
          {
            "name": "$select",
            "in": "query",
            "required": false,
            "type": "string"
          },
          {
            "name": "$expand",
            "in": "query",
            "required": false,
            "type": "string"
          },
          {
            "name": "partitionId",
            "in": "query",
            "required": false,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "DeleteRecordWithOrganization": {
        "path": "/{connectionId}/api/data/v9.1.0/{entityName}({recordId})",
        "method": "DELETE",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "organization",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "recordId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "partitionId",
            "in": "query",
            "required": false,
            "type": "string"
          }
        ],
        "responseInfo": {
          "204": {
            "type": "void"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "UpdateRecordWithOrganization": {
        "path": "/{connectionId}/api/data/v9.1.0/{entityName}({recordId})",
        "method": "PATCH",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "prefer",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "accept",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "organization",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "recordId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "item",
            "in": "body",
            "required": true,
            "type": "object"
          },
          {
            "name": "x-ms-odata-metadata-full",
            "in": "header",
            "required": false,
            "type": "boolean"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "UpdateOnlyRecordWithOrganization": {
        "path": "/{connectionId}/api/data/v9.2.0/{entityName}({recordId})",
        "method": "PATCH",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "prefer",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "accept",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "If-Match",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "organization",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "recordId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "item",
            "in": "body",
            "required": true,
            "type": "object"
          },
          {
            "name": "x-ms-odata-metadata-full",
            "in": "header",
            "required": false,
            "type": "boolean"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "Predict": {
        "path": "/{connectionId}/api/data/v9.0/msdyn_aimodels({modelId})/Microsoft.Dynamics.CRM.Predict",
        "method": "POST",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "modelId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "item",
            "in": "body",
            "required": true,
            "type": "object"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetPredictionSchema": {
        "path": "/{connectionId}/$metadata.json/api/data/v9.1/msdyn_aimodels({recordId})/Microsoft.Dynamics.CRM.PredictionSchema",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "recordId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "predictionMode",
            "in": "header",
            "required": false,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "PredictV2": {
        "path": "/{connectionId}/api/data/v9.1/msdyn_aimodels({recordId})/Microsoft.Dynamics.CRM.Predict",
        "method": "POST",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "recordId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "Prefer",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "item",
            "in": "body",
            "required": true,
            "type": "object"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "AddToFeedbackLoop": {
        "path": "/{connectionId}/api/data/v9.1/msdyn_aimodels({recordId})/Microsoft.Dynamics.CRM.AddToFeedbackLoop",
        "method": "POST",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "recordId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "item",
            "in": "body",
            "required": false,
            "type": "object"
          }
        ],
        "responseInfo": {
          "204": {
            "type": "void"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "PredictByReference": {
        "path": "/{connectionId}/api/data/v9.1/msdyn_aimodels({recordId})/Microsoft.Dynamics.CRM.PredictByReference",
        "method": "POST",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "recordId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "item",
            "in": "body",
            "required": true,
            "type": "object"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "AssociateEntities": {
        "path": "/{connectionId}/api/data/v9.1/{entityName}({recordId})/{associationEntityRelationship}/$ref",
        "method": "POST",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "recordId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "associationEntityRelationship",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "item",
            "in": "body",
            "required": true,
            "type": "object"
          }
        ],
        "responseInfo": {
          "204": {
            "type": "void"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "DisassociateEntities": {
        "path": "/{connectionId}/api/data/v9.1/{entityName}({recordId})/{associationEntityRelationship}/$ref",
        "method": "DELETE",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "recordId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "associationEntityRelationship",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "$id",
            "in": "query",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "204": {
            "type": "void"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "AssociateEntitiesWithOrganization": {
        "path": "/{connectionId}/api/data/v9.1.0/{entityName}({recordId})/{associationEntityRelationship}/$ref",
        "method": "POST",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "organization",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "recordId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "associationEntityRelationship",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "item",
            "in": "body",
            "required": true,
            "type": "object"
          }
        ],
        "responseInfo": {
          "204": {
            "type": "void"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "DisassociateEntitiesWithOrganization": {
        "path": "/{connectionId}/api/data/v9.1.0/{entityName}({recordId})/{associationEntityRelationship}/$ref",
        "method": "DELETE",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "organization",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "recordId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "associationEntityRelationship",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "$id",
            "in": "query",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "204": {
            "type": "void"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetMetadataForUnboundActionInput": {
        "path": "/{connectionId}/$metadata.json/flow/api/data/v9.1/{actionName}/inputs",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "actionName",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetMetadataForUnboundActionInputWithOrganization": {
        "path": "/{connectionId}/v1.0/$metadata.json/actions/unbound/{actionName}/inputs",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "organization",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "actionName",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetMetadataForBoundActionInput": {
        "path": "/{connectionId}/$metadata.json/api/data/v9.1/{entityName}/{actionName}/inputs",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "actionName",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetMetadataForBoundActionInputWithOrganization": {
        "path": "/{connectionId}/v1.0/$metadata.json/actions/bound/{entityName}/{actionName}/inputs",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "organization",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "actionName",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetMetadataForBoundOrUnboundActionInput": {
        "path": "/{connectionId}/$metadata.json/api/data/v9.2/{entityName}/{actionName}/asyncinputs",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "actionName",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetMetadataForBoundOrUnboundActionResponse": {
        "path": "/{connectionId}/$metadata.json/api/data/v9.2/{entityName}/{actionName}/asyncresponse",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "actionName",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetMetadataForUnboundActionResponse": {
        "path": "/{connectionId}/$metadata.json/flow/api/data/v9.1/{actionName}/response",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "actionName",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetMetadataForUnboundActionResponseWithOrganization": {
        "path": "/{connectionId}/v1.0/$metadata.json/actions/unbound/{actionName}/response",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "organization",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "actionName",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetMetadataForBoundActionResponse": {
        "path": "/{connectionId}/$metadata.json/api/data/v9.1/{entityName}/{actionName}/response",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "actionName",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetMetadataForBoundActionResponseWithOrganization": {
        "path": "/{connectionId}/v1.0/$metadata.json/actions/bound/{entityName}/{actionName}/response",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "organization",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "actionName",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetUnboundActions": {
        "path": "/{connectionId}/flow/api/data/v9.1/actions",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetUnboundActionsWithOrganization": {
        "path": "/{connectionId}/v1.0/$metadata.json/GetActionListEnum/GetUnboundActionsWithOrganization",
        "method": "POST",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "organization",
            "in": "header",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetBoundActions": {
        "path": "/{connectionId}/api/data/v9.1/{entityName}/actions",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetBoundActionsWithOrganization": {
        "path": "/{connectionId}/v1.0/$metadata.json/GetActionListEnum/GetBoundActionsWithOrganization",
        "method": "POST",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "organization",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "body",
            "in": "body",
            "required": true,
            "type": "object"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "PerformUnboundAction": {
        "path": "/{connectionId}/flow/api/data/v9.1/{actionName}",
        "method": "POST",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "actionName",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "item",
            "in": "body",
            "required": false,
            "type": "object"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "PerformUnboundActionWithOrganization": {
        "path": "/{connectionId}/flow/api/data/v9.1.0/{actionName}",
        "method": "POST",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "organization",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "actionName",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "item",
            "in": "body",
            "required": false,
            "type": "object"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "PerformBoundAction": {
        "path": "/{connectionId}/api/data/v9.1/{entityName}({recordId})/{actionName}",
        "method": "POST",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "actionName",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "recordId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "item",
            "in": "body",
            "required": false,
            "type": "object"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "PerformBoundActionWithOrganization": {
        "path": "/{connectionId}/api/data/v9.1.0/{entityName}({recordId})/{actionName}",
        "method": "POST",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "organization",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "actionName",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "recordId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "item",
            "in": "body",
            "required": false,
            "type": "object"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "RecordSelected": {
        "path": "/{connectionId}/hybridtriggers/entities/{entityName}/onrecordselected",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "ExecuteChangeset": {
        "path": "/{connectionId}/api/data/v9.1/$batch",
        "method": "POST",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "void"
          }
        }
      },
      "UpdateEntityFileImageFieldContent": {
        "path": "/{connectionId}/api/data/v9.1/{entityName}({recordId})/{fileImageFieldName}",
        "method": "PUT",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "content-type",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "recordId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "fileImageFieldName",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "item",
            "in": "body",
            "required": true,
            "type": "object"
          },
          {
            "name": "x-ms-file-name",
            "in": "query",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "204": {
            "type": "void"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "UpdateEntityFileImageFieldContentWithOrganization": {
        "path": "/{connectionId}/api/data/v9.1.0/{entityName}({recordId})/{fileImageFieldName}",
        "method": "PUT",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "content-type",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "organization",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "recordId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "fileImageFieldName",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "item",
            "in": "body",
            "required": true,
            "type": "object"
          },
          {
            "name": "x-ms-file-name",
            "in": "query",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "204": {
            "type": "void"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetEntityFileImageFieldContent": {
        "path": "/{connectionId}/api/data/v9.1/{entityName}({recordId})/{fileImageFieldName}/$value",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "Range",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "recordId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "fileImageFieldName",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "size",
            "in": "query",
            "required": false,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "string",
            "format": "binary"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetEntityFileImageFieldContentWithOrganization": {
        "path": "/{connectionId}/api/data/v9.1.0/{entityName}({recordId})/{fileImageFieldName}/$value",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "Range",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "organization",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "recordId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "fileImageFieldName",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "size",
            "in": "query",
            "required": false,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "string",
            "format": "binary"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "FlowStepRun": {
        "path": "/{connectionId}/hybridtriggers/onflowsteprun",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetRelevantRows": {
        "path": "/{connectionId}/api/search/v1.0/query",
        "method": "POST",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "SearchRequest",
            "in": "body",
            "required": true,
            "type": "object"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetCatalogs": {
        "path": "/{connectionId}/api/data/v9.2/catalogs",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetCategories": {
        "path": "/{connectionId}/api/data/v9.2/catalog/{catalog}/categories",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "catalog",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetEntitiesForActionTrigger": {
        "path": "/{connectionId}/api/data/v9.2/catalog/{catalog}/category/{category}/entitiesForActionTrigger",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "catalog",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "category",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetEntitiesForBackgroundOperations": {
        "path": "/{connectionId}/api/data/v9.2/catalog/{catalog}/category/{category}/entitiesForBackgroundOperations",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "catalog",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "category",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetActionsForActionTrigger": {
        "path": "/{connectionId}/api/data/v9.2/catalog/{catalog}/category/{category}/entityForActionTrigger/{entity}/actions",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "catalog",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "category",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "entity",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetMetadataForActionInputAndResponseForWhenAnActionIsPerformedTrigger": {
        "path": "/{connectionId}/$metadata.json/whenAnActionIsPerformedEntity/{entityName}/whenAnActionIsPerformedAction/{actionName}",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "actionName",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "BusinessEventsTrigger": {
        "path": "/{connectionId}/api/data/v9.2/callbackregistrations",
        "method": "POST",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "Consistency",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "catalog",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "category",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "subscriptionRequest",
            "in": "body",
            "required": true,
            "type": "object"
          }
        ],
        "responseInfo": {
          "204": {
            "type": "void"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "PerformBackgroundOperation": {
        "path": "/{connectionId}/api/data/v9.2/{actionName}",
        "method": "POST",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "item",
            "in": "body",
            "required": true,
            "type": "object"
          },
          {
            "name": "Consistency",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "x-ms-dyn-callback-url",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "catalog",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "category",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "entityName",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "actionName",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "202": {
            "type": "object"
          },
          "204": {
            "type": "void"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetBackgroundOperations": {
        "path": "/{connectionId}/api/data/v9.2/GetBackgroundOperations(catalogUniqueName='{catalog}',categoryUniqueName='{category}',entityLogicalName='{entity}')",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "catalog",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "category",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "entity",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetNextPageWithOrganization": {
        "path": "/{connectionId}/nextLink",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "organization",
            "in": "query",
            "required": true,
            "type": "string"
          },
          {
            "name": "next",
            "in": "query",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "void"
          },
          "400": {
            "type": "void"
          },
          "401": {
            "type": "void"
          },
          "403": {
            "type": "void"
          },
          "500": {
            "type": "void"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "InvokeMCP": {
        "path": "/{connectionId}/api/mcp",
        "method": "POST",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "Mcp-Session-Id",
            "in": "header",
            "required": false,
            "type": "string"
          },
          {
            "name": "queryRequest",
            "in": "body",
            "required": false,
            "type": "object"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "void"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetInvokeMCP": {
        "path": "/{connectionId}/api/mcp",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "Mcp-Session-Id",
            "in": "header",
            "required": false,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "201": {
            "type": "object"
          }
        }
      },
      "InvokeMCPPreview": {
        "path": "/{connectionId}/api/mcp_preview",
        "method": "POST",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "Mcp-Session-Id",
            "in": "header",
            "required": false,
            "type": "string"
          },
          {
            "name": "queryRequest",
            "in": "body",
            "required": false,
            "type": "object"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "void"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "GetInvokeMCPPreview": {
        "path": "/{connectionId}/api/mcp_preview",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "Mcp-Session-Id",
            "in": "header",
            "required": false,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "201": {
            "type": "object"
          }
        }
      },
      "mcp_SalesMCPServer": {
        "path": "/{connectionId}/mcp/SalesMCPServer",
        "method": "POST",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "queryRequest",
            "in": "body",
            "required": false,
            "type": "object"
          },
          {
            "name": "sessionId",
            "in": "query",
            "required": false,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "mcp_ServiceMCPServer": {
        "path": "/{connectionId}/mcp/ServiceMCPServer",
        "method": "POST",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "queryRequest",
            "in": "body",
            "required": false,
            "type": "object"
          },
          {
            "name": "sessionId",
            "in": "query",
            "required": false,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "mcp_ERPMCPServer": {
        "path": "/{connectionId}/mcp/ERPMCPServer",
        "method": "POST",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "queryRequest",
            "in": "body",
            "required": false,
            "type": "object"
          },
          {
            "name": "sessionId",
            "in": "query",
            "required": false,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "mcp_DataverseMCPServer": {
        "path": "/{connectionId}/mcp/DataverseMCPServer",
        "method": "POST",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "queryRequest",
            "in": "body",
            "required": false,
            "type": "object"
          },
          {
            "name": "sessionId",
            "in": "query",
            "required": false,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "mcp_ContactCenterMCPServer": {
        "path": "/{connectionId}/mcp/ContactCenterMCPServer",
        "method": "POST",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "queryRequest",
            "in": "body",
            "required": false,
            "type": "object"
          },
          {
            "name": "sessionId",
            "in": "query",
            "required": false,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "mcp_ConversationOrchestratorMCPServer": {
        "path": "/{connectionId}/mcp/ConversationOrchestratorMCPServer",
        "method": "POST",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "queryRequest",
            "in": "body",
            "required": false,
            "type": "object"
          },
          {
            "name": "sessionId",
            "in": "query",
            "required": false,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      }
    }
  },
  "lm_approvalcycles": {
    "tableId": "",
    "version": "",
    "primaryKey": "lm_approvalcycleid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "lm_approvalcyclesteps": {
    "tableId": "",
    "version": "",
    "primaryKey": "lm_approvalcyclestepid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "lm_auditgridanswers": {
    "tableId": "",
    "version": "",
    "primaryKey": "lm_auditgridanswerid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "lm_auditgridinstances": {
    "tableId": "",
    "version": "",
    "primaryKey": "lm_auditgridinstanceid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "lm_authoritymatrixrows": {
    "tableId": "",
    "version": "",
    "primaryKey": "lm_authoritymatrixrowid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "businessunits": {
    "tableId": "",
    "version": "",
    "primaryKey": "businessunitid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "cr603_chklst_departmentses": {
    "tableId": "",
    "version": "",
    "primaryKey": "cr603_chklst_departmentsid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "hr_employees": {
    "tableId": "",
    "version": "",
    "primaryKey": "hr_employeeid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "hr_functions": {
    "tableId": "",
    "version": "",
    "primaryKey": "hr_functionid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "strategy_kpises": {
    "tableId": "",
    "version": "",
    "primaryKey": "strategy_kpisid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "lm_meetingattendeeslists": {
    "tableId": "",
    "version": "",
    "primaryKey": "lm_meetingattendeeslistid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "lm_meetingminuteses": {
    "tableId": "",
    "version": "",
    "primaryKey": "lm_meetingminutesid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "lm_meetingoccurrenceagendas": {
    "tableId": "",
    "version": "",
    "primaryKey": "lm_meetingoccurrenceagendaid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "lm_meetingoccurrenceattendeeses": {
    "tableId": "",
    "version": "",
    "primaryKey": "lm_meetingoccurrenceattendeesid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "lm_meetingoccurrencedepartmentfunctions": {
    "tableId": "",
    "version": "",
    "primaryKey": "lm_meetingoccurrencedepartmentfunctionid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "lm_meetingoccurrences": {
    "tableId": "",
    "version": "",
    "primaryKey": "lm_meetingoccurrenceid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "lm_meetingtemplateagendaitems": {
    "tableId": "",
    "version": "",
    "primaryKey": "lm_meetingtemplateagendaitemid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "lm_meetingtemplatebusinessunitses": {
    "tableId": "",
    "version": "",
    "primaryKey": "lm_meetingtemplatebusinessunitsid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "lm_meetingtemplatedepartmentfunctions": {
    "tableId": "",
    "version": "",
    "primaryKey": "lm_meetingtemplatedepartmentfunctionid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "lm_meetingtemplatelinkedreportses": {
    "tableId": "",
    "version": "",
    "primaryKey": "lm_meetingtemplatelinkedreportsid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "lm_meetingtemplateregions": {
    "tableId": "",
    "version": "",
    "primaryKey": "lm_meetingtemplateregionid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "lm_meetingtemplates": {
    "tableId": "",
    "version": "",
    "primaryKey": "lm_meetingtemplateid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "lm_meetingtemplatesupportivefunctionses": {
    "tableId": "",
    "version": "",
    "primaryKey": "lm_meetingtemplatesupportivefunctionsid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "lm_momnoteses": {
    "tableId": "",
    "version": "",
    "primaryKey": "lm_momnotesid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "cr603_organizationstructures": {
    "tableId": "",
    "version": "",
    "primaryKey": "cr603_organizationstructureid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "strategy_processes": {
    "tableId": "",
    "version": "",
    "primaryKey": "strategy_processid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "crd04_regionses": {
    "tableId": "",
    "version": "",
    "primaryKey": "crd04_regionsid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "lm_reportoccurrencehistories": {
    "tableId": "",
    "version": "",
    "primaryKey": "lm_reportoccurrencehistoryid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "lm_reportoccurrences": {
    "tableId": "",
    "version": "",
    "primaryKey": "lm_reportoccurrenceid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "lm_reportoccurrencesectionses": {
    "tableId": "",
    "version": "",
    "primaryKey": "lm_reportoccurrencesectionsid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "lm_reportoccurrenceshares": {
    "tableId": "",
    "version": "",
    "primaryKey": "lm_reportoccurrenceshareid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "lm_reportsectioncitationses": {
    "tableId": "",
    "version": "",
    "primaryKey": "lm_reportsectioncitationsid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "lm_reporttemplatebusinessunitses": {
    "tableId": "",
    "version": "",
    "primaryKey": "lm_reporttemplatebusinessunitsid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "lm_reporttemplatecontentchecklists": {
    "tableId": "",
    "version": "",
    "primaryKey": "lm_reporttemplatecontentchecklistid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "lm_reporttemplatedepartmentfunctions": {
    "tableId": "",
    "version": "",
    "primaryKey": "lm_reporttemplatedepartmentfunctionid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "lm_reporttemplateregions": {
    "tableId": "",
    "version": "",
    "primaryKey": "lm_reporttemplateregionid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "lm_reporttemplaterelatedkpises": {
    "tableId": "",
    "version": "",
    "primaryKey": "lm_reporttemplaterelatedkpisid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "lm_reporttemplaterelatedprocesseses": {
    "tableId": "",
    "version": "",
    "primaryKey": "lm_reporttemplaterelatedprocessesid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "lm_reporttemplatereviewchains": {
    "tableId": "",
    "version": "",
    "primaryKey": "lm_reporttemplatereviewchainid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "lm_reporttemplatesectionitemses": {
    "tableId": "",
    "version": "",
    "primaryKey": "lm_reporttemplatesectionitemsid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "lm_report_templates": {
    "tableId": "",
    "version": "",
    "primaryKey": "lm_report_templateid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "lm_setupactivities": {
    "tableId": "",
    "version": "",
    "primaryKey": "lm_setupactivityid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "cr301_specialtyksa_service_hubs": {
    "tableId": "",
    "version": "",
    "primaryKey": "cr301_specialtyksa_service_hubid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "and_teamschannels": {
    "tableId": "",
    "version": "",
    "primaryKey": "and_teamschannelid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "systemusers": {
    "tableId": "",
    "version": "",
    "primaryKey": "systemuserid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "documents": {
    "tableId": "20a0173f-dfd6-4537-84ca-ff60b9a09c79",
    "version": "",
    "primaryKey": "ID",
    "dataSourceType": "Connector",
    "apis": {
      "GetAuthor": {
        "path": "/{connectionId}/datasets/{dataset}/tables/20a0173fdfd6453784caff60b9a09c79/entities/Author",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "dataset",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "table",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "search",
            "in": "query",
            "required": false,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "array"
          }
        }
      },
      "GetEditor": {
        "path": "/{connectionId}/datasets/{dataset}/tables/20a0173fdfd6453784caff60b9a09c79/entities/Editor",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "dataset",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "table",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "search",
            "in": "query",
            "required": false,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "array"
          }
        }
      },
      "GetWeeks": {
        "path": "/{connectionId}/datasets/{dataset}/tables/20a0173fdfd6453784caff60b9a09c79/entities/Weeks",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "dataset",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "table",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "search",
            "in": "query",
            "required": false,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "array"
          }
        }
      },
      "GetMonth": {
        "path": "/{connectionId}/datasets/{dataset}/tables/20a0173fdfd6453784caff60b9a09c79/entities/Month",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "dataset",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "table",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "search",
            "in": "query",
            "required": false,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "array"
          }
        }
      },
      "GetYear": {
        "path": "/{connectionId}/datasets/{dataset}/tables/20a0173fdfd6453784caff60b9a09c79/entities/Year",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "dataset",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "table",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "search",
            "in": "query",
            "required": false,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "array"
          }
        }
      },
      "GetDocument_x0020_Status": {
        "path": "/{connectionId}/datasets/{dataset}/tables/20a0173fdfd6453784caff60b9a09c79/entities/Document_x0020_Status",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "dataset",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "table",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "search",
            "in": "query",
            "required": false,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "array"
          }
        }
      },
      "GetPDCA": {
        "path": "/{connectionId}/datasets/{dataset}/tables/20a0173fdfd6453784caff60b9a09c79/entities/PDCA",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "dataset",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "table",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "search",
            "in": "query",
            "required": false,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "array"
          }
        }
      },
      "GetCheckoutUser": {
        "path": "/{connectionId}/datasets/{dataset}/tables/20a0173fdfd6453784caff60b9a09c79/entities/CheckoutUser",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "dataset",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "table",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "search",
            "in": "query",
            "required": false,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "array"
          }
        }
      },
      "Get4651e8f238c94ad08def41f743f76f30": {
        "path": "/{connectionId}/datasets/{dataset}/tables/20a0173fdfd6453784caff60b9a09c79/entities/4651e8f238c94ad08def41f743f76f30",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "dataset",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "table",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "search",
            "in": "query",
            "required": false,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "array"
          }
        }
      }
    }
  }
};
