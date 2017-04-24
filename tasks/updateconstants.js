const request = require('request');
const async = require('async');
const fs = require('fs');
const sources = [
  {
    key: "items",
    url: [
      'https://raw.githubusercontent.com/dotabuff/d2vpkr/master/dota/resource/dota_english.json',
      'https://raw.githubusercontent.com/dotabuff/d2vpkr/master/dota/scripts/npc/items.json'
    ],
    transform: respObj => {
      const strings = respObj[0].lang.Tokens;
      const scripts = respObj[1].DOTAAbilities;

      // Fix places where valve doesnt care about correct case
      Object.keys(strings).forEach(key => {
        if (key.includes("DOTA_Tooltip_Ability_")) {
          strings[key.replace("DOTA_Tooltip_Ability_", "DOTA_Tooltip_ability_")] = strings[key];
        }
      })

      var items = {};

      Object.keys(scripts).filter(key => {
        return !(key.includes("item_recipe") && scripts[key].ItemCost === "0") && key !== "Version";
      }).forEach(key => {
        var item = {};

        item.id = parseInt(scripts[key].ID);
        item.img = `/apps/dota2/images/items/${key.replace(/^item_/, '')}_lg.png?3`;
        if (key.includes("item_recipe")) {
          item.img = "/apps/dota2/images/items/recipe_lg.png?3";
        }

        item.dname = strings[`DOTA_Tooltip_ability_${key}`];
        item.qual = scripts[key].ItemQuality;
        item.cost = parseInt(scripts[key].ItemCost);

        item.desc = replaceSpecialAttribs(strings[`DOTA_Tooltip_ability_${key}_Description`], scripts[key].AbilitySpecial) || "";
        var notes = [];
        for (let i = 0; strings[`DOTA_Tooltip_ability_${key}_Note${i}`]; i++) {
          notes.push(strings[`DOTA_Tooltip_ability_${key}_Note${i}`]);
        }

        item.notes = notes.join("\n");

        item.attrib = formatAttrib(scripts[key].AbilitySpecial, strings, `DOTA_Tooltip_ability_${key}_`);

        item.mc = parseInt(scripts[key].AbilityManaCost) || false;
        item.cd = parseInt(scripts[key].AbilityCooldown) || false;

        item.lore = (strings[`DOTA_Tooltip_ability_${key}_Lore`] || "").replace(/\\n/g, "\r\n");

        item.components = null;
        item.created = false;

        items[key.replace(/^item_/, '')] = item;
      });

      // Load recipes
      Object.keys(scripts).filter(key => scripts[key].ItemRequirements && scripts[key].ItemResult).forEach(key => {
        result_key = scripts[key].ItemResult.replace(/^item_/, '');
        items[result_key].components = scripts[key].ItemRequirements[0].split(";").map(item => item.replace(/^item_/, ''));
        items[result_key].created = true;
      });

      return items;
    },
  },
  {
    key: "item_ids",
    url: "http://www.dota2.com/jsfeed/itemdata?l=english",
    transform: respObj => {
      const items = respObj.itemdata;
      const itemIds = {};
      for (const key in items) {
        itemIds[items[key].id] = key;
      }
      return itemIds;
    },
  }, {
    key: "item_groups",
    url: "http://www.dota2.com/jsfeed/itemdata?l=english",
    transform: respObj => {
      const items = respObj.itemdata;
      const itemGroups = [];
      for (const key in items) {
        if (items[key].components) {
          const arr = expandItemGroup(key, items);
          const obj = {};
          arr.forEach(function(e) {
            obj[e] = 1;
          });
          itemGroups.push(obj);
        }
      }
      return itemGroups;
    },
  }, 
  {
    key: "abilities",
    url: [
      'https://raw.githubusercontent.com/dotabuff/d2vpkr/master/dota/resource/dota_english.json',
      'https://raw.githubusercontent.com/dotabuff/d2vpkr/master/dota/scripts/npc/npc_abilities.json'
    ],
    transform: respObj => {
      const strings = respObj[0].lang.Tokens;
      const scripts = respObj[1].DOTAAbilities;

      var not_abilities = [ "Version", "ability_base", "default_attack", "attribute_bonus", "ability_deward" ];

      var abilities = {};

      Object.keys(scripts).filter(key => !not_abilities.includes(key)).forEach(key => {
        var ability = {};

        ability.dname = strings[`DOTA_Tooltip_ability_${key}`];
        ability.desc = replaceSpecialAttribs(strings[`DOTA_Tooltip_ability_${key}_Description`], scripts[key].AbilitySpecial);
        ability.dmg = scripts[key].AbilityDamage && formatValues(scripts[key].AbilityDamage);

        ability.attrib = formatAttrib(scripts[key].AbilitySpecial, strings, `DOTA_Tooltip_ability_${key}_`);

        if(scripts[key].AbilityManaCost || scripts[key].AbilityCooldown) {
          if(scripts[key].AbilityManaCost) {
            ability.mc = formatValues(scripts[key].AbilityManaCost, false, "/");
          } 
          if(scripts[key].AbilityCooldown) {
            ability.cd = formatValues(scripts[key].AbilityCooldown, false, "/");
          }
        }

        ability.img = `/apps/dota2/images/abilities/${key}_md.png`;
        if (key.indexOf('special_bonus') === 0) {
          ability = { dname: ability.dname };
        }
        abilities[key] = ability;
      });
      return abilities;
    },
  }, {
    key: "ability_keys",
    url: "http://www.dota2.com/jsfeed/abilitydata?l=english",
    transform: respObj => {
      const abilityKeys = {};
      const abilities = respObj.abilitydata;
      for (const key in abilities) {
        abilityKeys[key] = 1;
      }
      return abilityKeys;
    },
  }, {
    key: "ability_ids",
    url: "https://raw.githubusercontent.com/dotabuff/d2vpkr/master/dota/scripts/npc/npc_abilities.json",
    transform: respObj => {
      const abilityIds = {};
      for (const key in respObj.DOTAAbilities) {
        const block = respObj.DOTAAbilities[key];
        if (block && block.ID) {
          abilityIds[block.ID] = key;
        }
      }
      return abilityIds;
    },
  }, {
    key: "heroes",
    url: "https://api.opendota.com/api/heroes",
    transform: respObj => {
      const heroes = {};
      respObj.forEach(function(h) {
        h.img = "/apps/dota2/images/heroes/" + h.name.replace("npc_dota_hero_", "") + "_full.png?";
        h.icon = "/apps/dota2/images/heroes/" + h.name.replace("npc_dota_hero_", "") + "_icon.png";
        heroes[h.id] = h;
      });
      return heroes;
    },
  }, {
    key: "hero_names",
    url: "https://api.opendota.com/api/heroes",
    transform: respObj => {
      const heroNames = {};
      respObj.forEach(function(h) {
        h.img = "/apps/dota2/images/heroes/" + h.name.replace("npc_dota_hero_", "") + "_full.png?";
        h.icon = "/apps/dota2/images/heroes/" + h.name.replace("npc_dota_hero_", "") + "_icon.png";
        heroNames[h.name] = h;
      });
      return heroNames;
    },
  }, {
    key: "region",
    url: "https://raw.githubusercontent.com/dotabuff/d2vpkr/master/dota/scripts/regions.json",
    transform: respObj => {
      const region = {};
      const regions = respObj.regions;
      for (const key in regions) {
        if (Number(regions[key].region) > 0) {
          region[regions[key].region] = regions[key].display_name.slice("#dota_region_".length).split("_").map(s => s.toUpperCase()).join(" ");
        }
      }
      return region;
    },
  }, {
    key: "cluster",
    url: "https://raw.githubusercontent.com/dotabuff/d2vpkr/master/dota/scripts/regions.json",
    transform: respObj => {
      const cluster = {};
      const regions = respObj.regions;
      for (const key in regions) {
        if (regions[key].clusters) {
          regions[key].clusters.forEach(function(c) {
            cluster[c] = Number(regions[key].region);
          });
        }
      }
      cluster["121"] = Number(regions['USEast'].region);
      return cluster;
    },
  }, {
    key: "countries",
    url: "https://raw.githubusercontent.com/mledoze/countries/master/countries.json",
    transform: respObj => {
      const countries = {};
      respObj.map(c => ({
        name: {
          common: c.name.common
        },
        cca2: c.cca2
      })).forEach(c => {
        countries[c.cca2] = c;
      });
      return countries;
    },
  },
];
// "heropickerdata": "http://www.dota2.com/jsfeed/heropickerdata?l=english",
// "heropediadata": "http://www.dota2.com/jsfeed/heropediadata?feeds=herodata",
// "leagues": "https://api.opendota.com/api/leagues",
async.each(sources, function(s, cb) {
      const url = s.url;
      //grab raw data from each url and save
      console.log(url);
      if (typeof url === 'object') {
        async.map(url, (urlString, cb) => {
          request(urlString, (err, resp, body) => {
            cb(err, JSON.parse(body));
          });
        }, (err, resultArr) => {
          handleResponse(err, {
            statusCode: 200
          }, JSON.stringify(resultArr));
        });
      }
      else {
        request(url, handleResponse);
      }

      function handleResponse(err, resp, body) {
        if (err || resp.statusCode !== 200) {
          return cb(err);
        }
        body = JSON.parse(body);
        if (s.transform) {
          body = s.transform(body);
        }
        fs.writeFileSync('./build/' + s.key + '.json', JSON.stringify(body, null, 2));
        cb(err);
      }
    },
    function(err) {
      if (err) {
        throw err;
      }
      // Copy manual json files to build
      const jsons = fs.readdirSync('./json');
      jsons.forEach((filename) => {
        fs.writeFileSync('./build/' + filename, fs.readFileSync('./json/' + filename, 'utf-8'));
      });
      // Reference built files in index.js
      const cfs = fs.readdirSync('./build');
      // Exports aren't supported in Node yet, so use old export syntax for now
      // const code = cfs.map((filename) => `export const ${filename.split('.')[0]} = require(__dirname + '/json/${filename.split('.')[0]}.json');`).join('\n';
      const code = `module.exports = {
${cfs.map((filename) => `${filename.split('.')[0]}: require(__dirname + '/build/${filename.split('.')[0]}.json')`).join(',\n')}
};`;
    fs.writeFileSync('./index.js', code);
    process.exit(0);
  });

function expandItemGroup(key, items) {
  let base = [key];
  if (items[key] && items[key].components) {
    return [].concat.apply(base, items[key].components.map(function (c) {
      return expandItemGroup(c, items);
    }));
  } else {
    return base;
  }
}

function replaceUselessDecimals(strToReplace) {
  return strToReplace.replace(/\.0+(\D)/, '$1');
}

// Formats something like "20 21 22" or [ 20, 21, 22 ] to be "20 / 21 / 22"
function formatValues(value, percent=false, separator=" / ") {
  var values = Array.isArray(value) ? value : String(value).split(" ");
  if (values.every(v => v == values[0])) {
    values = [ values[0] ];
  }
  if (percent){
    values = values.map(v => v + "%");
  }
  let len = values.length;
  let res = values.join(separator).replace(/\.0+(\D|$)/g, '$1');
  return len > 1 ? res.split(separator) : res;
}

// Formats AbilitySpecial for the attrib value for abilities and items
function formatAttrib(attributes, strings, strings_prefix) {
  return (attributes || []).map(attr => {
    let key = Object.keys(attr).find(key => `${strings_prefix}${key}` in strings);
    if (!key){
      return null;
    }

    let final = { key: key };
    let header = strings[`${strings_prefix}${key}`];
    let match = header.match(/(%)?(\+\$)?(.*)/);
    header = match[3];

    if (match[2]) {
      final.heaer = "+"
      final.value = formatValues(attr[key], match[1]);
      final.footer = strings[`dota_ability_variable_${header}`];
    } else {
      final.header = header;
      final.value = formatValues(attr[key], match[1]);
    }

    return final;
  }).filter(a => a);
}

// Formats templates like "Storm's movement speed is %storm_move_speed%" with "Storm's movement speed is 32"
// args are the template, and a list of attribute dictionaries, like the ones in AbilitySpecial for each ability in the npc_abilities.json from the vpk
function replaceSpecialAttribs(template, attribs) {
  if (!template) { 
    return template; 
  }
  if (attribs) {
    template = template.replace(/%([^%]*)%/g, function(str, name) {
      if (name == "") {
        return "%";
      }
      var attr = attribs.find(attr => name in attr);
      if (!attr && name[0] === "d") { // Because someone at valve messed up in 4 places
        name = name.substr(1);
        attr = attribs.find(attr => name in attr);
      } 
      if (!attr) {
        console.log(`cant find attribute %${name}%`);
        return `%${name}%`;
      }
      return attr[name];
    });
  }
  template = template.replace(/\\n/g, "\n");
  return template;
}
