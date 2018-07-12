import requests
import json

json_file = "mapOverlays.json"
out = {}
output_file = "noaaSourcePaths.json"

#read the the json file to find any Request Source Path urls
with open(json_file) as f:
	for line in f:
		if "requestSourcePath" in line:
			#extract the request source path from the line in the file
			url = line.split('":"')[1].replace('",',"").replace("http:", "https:").rstrip()
			#try and access the url
			r = requests.get(url)
			if r.status_code != 200:
				print ("ERROR accessing url: %s" % url)
			else:
				#get the tile url from the json response
				tile_url = r.json()[0].get('Tile_Directory_URL')
				if tile_url is None:
					print ("ERROR: could not find Tile_Directory_URL in %s" % url)
				else:
					#get the product name from the tile_url
					product = tile_url.split('/')[6]
					product_parts = product.split('.')
					name = "%s.%s" % (product_parts[0], product_parts[1])
					#add to the out dictionary
					out[name] = tile_url

#write the out dictionary to a json file
try:
	with open(output_file, 'w') as outfile:
		json.dump(out, outfile, indent=4)
except:
	print("Error writing to output file: %s" % output_file)

print("Done")
