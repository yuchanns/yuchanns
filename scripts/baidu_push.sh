#!/bin/bash
locs=($(grep -oP '(?<=loc>)[^<]+' "../sitemap.xml"))

for i in ${!locs[*]}
do
  echo "${locs[$i]}" >> urls.txt
done

curl -H 'Content-Type:text/plain' --data-binary @urls.txt "http://data.zz.baidu.com/urls?site=$BAIDU_PUSH_SITE&token=$BAIDU_PUSH_TOKEN"