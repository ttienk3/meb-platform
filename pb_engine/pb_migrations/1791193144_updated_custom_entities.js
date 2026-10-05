/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3681709587")

  // add field
  collection.fields.addAt(7, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text3423381675",
    "max": 0,
    "min": 0,
    "name": "barcode_base",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(8, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text1448046615",
    "max": 0,
    "min": 0,
    "name": "barcode_sub",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(9, new Field({
    "help": "",
    "hidden": false,
    "id": "number3185970395",
    "max": null,
    "min": null,
    "name": "price_base",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(10, new Field({
    "help": "",
    "hidden": false,
    "id": "number225347923",
    "max": null,
    "min": null,
    "name": "price_sub",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(11, new Field({
    "help": "",
    "hidden": false,
    "id": "number2692725418",
    "max": null,
    "min": null,
    "name": "min_safe_stock",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3681709587")

  // remove field
  collection.fields.removeById("text3423381675")

  // remove field
  collection.fields.removeById("text1448046615")

  // remove field
  collection.fields.removeById("number3185970395")

  // remove field
  collection.fields.removeById("number225347923")

  // remove field
  collection.fields.removeById("number2692725418")

  return app.save(collection)
})
