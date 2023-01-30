# yugiohscraper
Grabs all packs/tins/decks/etc. from the [official Konami Yu-Gi-Oh! card database](https://www.db.yugioh-card.com/yugiohdb/card_list.action) and writes them to a local database.

## Data Format
The local database (SQL) expects two tables with the following columns:
### Table Name: packs
- `pack_id` PRIMARY KEY
- `name`
- `release_date`
- `card_count`
- `created_on`
- `image_referer` UNIQUE
### Table Name: cards
- `card_id` PRIMARY KEY
- `pack_id` FOREIGN KEY
- `image`
- `name`
- `attribute_type`
- `trap_spell_effect`
- `monster_level`
- `monster_type`
- `monster_atk`
- `monster_def`
- `card_effect`
- `created_on` 
## Notes
1. Non-monster cards write null values to the DB for any columns prefixed with `monster`.
2. The `image_referer` value must be the value you check for uniqueness because there are a few instances of card collections sharing the same names.
These collections are indeed unqiue, but their names aren't. Their image referer links are though, and this is how you can tell two same-named releases apart. 
3. In order to load card images, the card image links require the proper `referer` header to present in the request.
This is the reason for the inclusion of the `image_referer` column in the packs table. All cards in a particular pack will have the same referer.

An example fetch request for the card: *Labrynth Set-Up*:
```
fetch("https://www.db.yugioh-card.com/yugiohdb/get_image.action?type=1&osplang=1&cid=17368&ciid=1&enc=mnDTjcM-sgn8w3Yh3Afh4A",
{ headers: { Referer: "https://www.db.yugioh-card.com/yugiohdb/card_search.action?ope=1&sess=1&pid=2000001172000&rp=99999" }, });
```
The referer url is found by using the card's `pack_id` to query the corresponding pack, and then finding the `image_referer` value for that pack.
The response is a PNG bnary which you can then write to disk.
