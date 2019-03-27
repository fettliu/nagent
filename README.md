
                     ``                              
                     `.`.`                           
                      .yys                           
                       -:-``      ./:                
           .`.:  `      /++/.  ..``.`                
           ` -/`-//     ://:` -///`                  
                `-.`-::` -/++/---.                   
                   `-::.o*******+ .::.`+/             
                       .(nagent) `://: -.             
               ``  -::` +*******  ``                 
               `.  os` -/:` `-///:-os+                   
               `  ``       :/:`  `+o/`                  
                          ...`       .`                 
                          ``                      

# nagent
nat agent like frp for through your nat.  
Source code writed by Javascript, run at Nodejs.  
[\[中文说明书\]](./说明书.md)  
  
## deployment
install nodejs if you havn't that.  
  
## run as server
### windows/linux:  
node nagent.js -s  
### linux:  
./nagent.js -s  
### watch state:   
watch cat nagent-state   
  
## run as client
windows/linux:  
node nagent.js -p 90 -P 80  
linux:  
./nagent.js -p 90 -P 80  
  
## config
Save follow content to nagent.config in directory of nagent.js.  
local_port=\[your local service port\]  
server_port=5670// server default port  
server_host='\[your server host\]'  
remote_port=\[you need internat port by server\]  
keep_conn_count=10// keep max connection count at one time.  
  
